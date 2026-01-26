"""Research graph implementation using pydantic-graph."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext

from cl_logs.logging import get_logger

from crystalith.agents.models import build_chat_model
from crystalith.db import (
    ResearchSession,
    ResearchStatus,
    ResearchStep,
    ResearchStepStatus,
    ResearchStepType,
)

from .types import (
    IterationAnalysis,
    ResearchDeps,
    ResearchGraphState,
    SearchPlan,
    SearchQuery,
    SearchResult,
)


log = get_logger(__name__)


# =============================================================================
# Pydantic Models for AI Output
# =============================================================================


class SearchPlanOutput(BaseModel):
    """AI output for search plan generation."""

    model_config = ConfigDict(extra="forbid")

    queries: list[dict[str, Any]]
    reasoning: str


class AnalysisOutput(BaseModel):
    """AI output for result analysis."""

    model_config = ConfigDict(extra="forbid")

    summary: str
    coverage_estimate: float
    need_more_search: bool
    suggested_queries: list[str]


class ReportOutput(BaseModel):
    """AI output for final report."""

    model_config = ConfigDict(extra="forbid")

    report: str


# =============================================================================
# Prompts
# =============================================================================


PLAN_SYSTEM_PROMPT = """You are a research assistant planning search queries.
Given a research topic and optional previous results, generate 2-4 search queries.
Each query should target different aspects of the topic.
Return JSON with 'queries' (list of {query, engine, priority, reason}) and 'reasoning'.
Engine options: Web, Scholar, Docs. Priority: 1=high, 2=medium, 3=low."""


ANALYSIS_SYSTEM_PROMPT = """You are a research analyst evaluating search results.
Analyze the results for coverage and relevance to the topic.
Return JSON with:
- summary: Brief summary of findings
- coverage_estimate: 0.0-1.0 how well results cover the topic
- need_more_search: true if more searches would help
- suggested_queries: List of suggested follow-up queries if needed"""


REPORT_SYSTEM_PROMPT = """You are a research assistant writing a final report.
Based on the search results collected, write a comprehensive research report.
Include key findings, sources, and recommendations.
Format as Markdown."""


# =============================================================================
# Graph Nodes
# =============================================================================


@dataclass
class PlanSearches(BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]]):
    """Generate a search plan for the current iteration."""

    async def run(
        self, ctx: GraphRunContext[ResearchGraphState, ResearchDeps]
    ) -> "ExecuteSearches | WaitForApproval":
        state = ctx.state
        deps = ctx.deps

        log.info(
            "planning searches",
            session_id=state.session_id,
            iteration=state.current_iteration,
        )

        # Emit thinking event
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "planning",
                "message": f"🔍 正在分析研究主题「{state.topic}」，生成第 {state.current_iteration} 轮搜索策略...",
                "iteration": state.current_iteration,
            })

        # Build prompt
        prompt_parts = [f"Research topic: {state.topic}"]
        prompt_parts.append(f"Iteration: {state.current_iteration}/{state.max_iterations}")

        if state.all_results:
            prompt_parts.append(f"\nPrevious results found: {len(state.all_results)}")
            # Summarize previous results
            titles = [r.title for r in state.all_results[:10]]
            prompt_parts.append("Sample titles: " + ", ".join(titles))

        if state.analysis and state.analysis.suggested_queries:
            prompt_parts.append("\nSuggested focus areas: " + ", ".join(state.analysis.suggested_queries))

        user_prompt = "\n".join(prompt_parts)

        # Generate plan using AI
        try:
            model = build_chat_model(deps.settings)
            agent = Agent(
                model,
                output_type=SearchPlanOutput,
                system_prompt=PLAN_SYSTEM_PROMPT,
                retries=2,
            )
            result = await agent.run(user_prompt)

            queries = []
            for q in result.output.queries[:5]:  # Max 5 queries
                queries.append(
                    SearchQuery(
                        query=q.get("query", ""),
                        engine=q.get("engine", "Web"),
                        priority=q.get("priority", 1),
                        reason=q.get("reason", ""),
                    )
                )

            state.search_plan = SearchPlan(
                iteration=state.current_iteration,
                queries=queries,
                reasoning=result.output.reasoning,
                estimated_results=len(queries) * 10,
            )

            log.info(
                "search plan generated",
                session_id=state.session_id,
                query_count=len(queries),
            )

            # Emit thinking event with reasoning
            if deps.on_thinking:
                await deps.on_thinking({
                    "type": "reasoning",
                    "message": f"💭 {result.output.reasoning}",
                    "iteration": state.current_iteration,
                })
                await deps.on_thinking({
                    "type": "plan_generated",
                    "message": f"📋 已生成 {len(queries)} 个搜索查询",
                    "iteration": state.current_iteration,
                    "queries": [q.query for q in queries],
                })

        except Exception as error:
            log.warning("search plan generation failed, using fallback", error=str(error))
            # Fallback: simple query based on topic
            state.search_plan = SearchPlan(
                iteration=state.current_iteration,
                queries=[
                    SearchQuery(query=state.topic, engine="Web", priority=1, reason="主题搜索"),
                    SearchQuery(query=f"{state.topic} 最新", engine="Web", priority=2, reason="最新内容"),
                ],
                reasoning="使用默认搜索策略",
                estimated_results=20,
            )

        # Record step
        step = ResearchStep(
            session_id=state.session_id,
            iteration=state.current_iteration,
            type=ResearchStepType.PLAN,
            input_data={"topic": state.topic, "iteration": state.current_iteration},
            output_data={
                "queries": [{"query": q.query, "engine": q.engine, "priority": q.priority, "reason": q.reason} for q in state.search_plan.queries],
                "reasoning": state.search_plan.reasoning,
            },
            status=ResearchStepStatus.COMPLETED,
        )
        deps.session.add(step)

        # Update session status
        research = await deps.session.get(ResearchSession, state.session_id)
        if research:
            research.status = ResearchStatus.WAITING_USER
            await deps.session.commit()

        # Notify progress
        if deps.on_plan_ready:
            await deps.on_plan_ready(state.search_plan)

        # For now, go directly to execute (Phase 3 will add WaitForApproval)
        state.waiting_for_user = True
        return WaitForApproval()


@dataclass
class WaitForApproval(BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]]):
    """Wait for user to approve/modify the search plan."""

    async def run(
        self, ctx: GraphRunContext[ResearchGraphState, ResearchDeps]
    ) -> "ExecuteSearches | AnalyzeResults | GenerateReport":
        state = ctx.state
        deps = ctx.deps

        log.info(
            "waiting for user approval",
            session_id=state.session_id,
            iteration=state.current_iteration,
        )

        # In Phase 2, we auto-approve. Phase 3 will implement actual waiting.
        # For now, check if user_action was set externally
        if state.user_action == "skip":
            state.user_action = None
            if state.current_iteration >= state.max_iterations:
                return GenerateReport()
            state.current_iteration += 1
            return AnalyzeResults()  # Skip to analysis with current results

        if state.user_action == "finish":
            state.user_action = None
            return GenerateReport()

        # Default: approve and continue
        state.user_action = None
        state.waiting_for_user = False
        return ExecuteSearches()


@dataclass
class ExecuteSearches(BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]]):
    """Execute the search plan."""

    async def run(
        self, ctx: GraphRunContext[ResearchGraphState, ResearchDeps]
    ) -> "AnalyzeResults":
        state = ctx.state
        deps = ctx.deps

        if not state.search_plan:
            log.warning("no search plan, skipping execution")
            return AnalyzeResults()

        log.info(
            "executing searches",
            session_id=state.session_id,
            iteration=state.current_iteration,
            query_count=len(state.search_plan.queries),
        )

        # Emit thinking event
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "searching",
                "message": f"🌐 开始执行 {len(state.search_plan.queries)} 个搜索查询...",
                "iteration": state.current_iteration,
            })

        # Update session status
        research = await deps.session.get(ResearchSession, state.session_id)
        if research:
            research.status = ResearchStatus.SEARCHING
            await deps.session.commit()

        state.current_results = []

        for i, sq in enumerate(state.search_plan.queries):
            try:
                results = await deps.searcher.search(sq.query, mode=sq.engine)

                for r in results:
                    sr = SearchResult(
                        title=r.title,
                        url=r.url,
                        snippet=r.snippet,
                        source=r.engine or sq.engine,
                        iteration=state.current_iteration,
                    )
                    state.current_results.append(sr)

                    # Notify progress
                    if deps.on_search_result:
                        await deps.on_search_result(sr)

                log.debug(
                    "search completed",
                    query=sq.query[:50],
                    result_count=len(results),
                )

                # Emit thinking event for each query
                if deps.on_thinking:
                    await deps.on_thinking({
                        "type": "search_result",
                        "message": f"🔎 「{sq.query[:30]}...」 找到 {len(results)} 条结果",
                        "iteration": state.current_iteration,
                        "query": sq.query,
                        "count": len(results),
                    })

            except Exception as error:
                log.warning("search failed", query=sq.query[:50], error=str(error))

        # Deduplicate by URL
        seen_urls: set[str] = {r.url for r in state.all_results}
        new_results = [r for r in state.current_results if r.url not in seen_urls]
        state.all_results.extend(new_results)

        log.info(
            "searches completed",
            session_id=state.session_id,
            new_results=len(new_results),
            total_results=len(state.all_results),
        )

        # Record step
        step = ResearchStep(
            session_id=state.session_id,
            iteration=state.current_iteration,
            type=ResearchStepType.SEARCH,
            input_data={
                "queries": [q.query for q in state.search_plan.queries],
            },
            output_data={
                "result_count": len(state.current_results),
                "new_results": len(new_results),
            },
            status=ResearchStepStatus.COMPLETED,
        )
        deps.session.add(step)
        await deps.session.commit()

        return AnalyzeResults()


@dataclass
class AnalyzeResults(BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]]):
    """Analyze search results and decide whether to continue."""

    async def run(
        self, ctx: GraphRunContext[ResearchGraphState, ResearchDeps]
    ) -> "PlanSearches | GenerateReport":
        state = ctx.state
        deps = ctx.deps

        log.info(
            "analyzing results",
            session_id=state.session_id,
            iteration=state.current_iteration,
            result_count=len(state.all_results),
        )

        # Emit thinking event
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "analyzing",
                "message": f"📊 正在分析 {len(state.all_results)} 条搜索结果...",
                "iteration": state.current_iteration,
            })

        # Update session status
        research = await deps.session.get(ResearchSession, state.session_id)
        if research:
            research.status = ResearchStatus.ANALYZING
            await deps.session.commit()

        # Build prompt for analysis
        prompt_parts = [f"Research topic: {state.topic}"]
        prompt_parts.append(f"Iteration: {state.current_iteration}/{state.max_iterations}")
        prompt_parts.append(f"Total results: {len(state.all_results)}")

        if state.all_results:
            prompt_parts.append("\nResults summary:")
            for i, r in enumerate(state.all_results[:20], 1):
                prompt_parts.append(f"{i}. {r.title}")
                if r.snippet:
                    prompt_parts.append(f"   {r.snippet[:100]}...")

        user_prompt = "\n".join(prompt_parts)

        # Analyze using AI
        try:
            model = build_chat_model(deps.settings)
            agent = Agent(
                model,
                output_type=AnalysisOutput,
                system_prompt=ANALYSIS_SYSTEM_PROMPT,
                retries=2,
            )
            result = await agent.run(user_prompt)

            state.analysis = IterationAnalysis(
                iteration=state.current_iteration,
                result_count=len(state.all_results),
                coverage=result.output.coverage_estimate,
                summary=result.output.summary,
                need_more_search=result.output.need_more_search,
                suggested_queries=result.output.suggested_queries,
            )

        except Exception as error:
            log.warning("analysis failed, using fallback", error=str(error))
            # Fallback analysis
            coverage = min(1.0, len(state.all_results) / 30)  # Assume 30 results is good coverage
            state.analysis = IterationAnalysis(
                iteration=state.current_iteration,
                result_count=len(state.all_results),
                coverage=coverage,
                summary=f"已收集 {len(state.all_results)} 条结果",
                need_more_search=coverage < 0.7 and state.current_iteration < state.max_iterations,
                suggested_queries=[],
            )

        log.info(
            "analysis completed",
            session_id=state.session_id,
            coverage=state.analysis.coverage,
            need_more=state.analysis.need_more_search,
        )

        # Emit thinking event with summary
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "analysis_complete",
                "message": f"📈 分析完成：覆盖度 {int(state.analysis.coverage * 100)}%",
                "iteration": state.current_iteration,
                "coverage": state.analysis.coverage,
            })
            if state.analysis.summary:
                await deps.on_thinking({
                    "type": "insight",
                    "message": f"💡 {state.analysis.summary}",
                    "iteration": state.current_iteration,
                })
            if state.analysis.need_more_search:
                await deps.on_thinking({
                    "type": "decision",
                    "message": "🔄 需要更多搜索，准备下一轮...",
                    "iteration": state.current_iteration,
                })

        # Record step
        step = ResearchStep(
            session_id=state.session_id,
            iteration=state.current_iteration,
            type=ResearchStepType.ANALYZE,
            input_data={"result_count": len(state.all_results)},
            output_data={
                "coverage": state.analysis.coverage,
                "summary": state.analysis.summary,
                "need_more_search": state.analysis.need_more_search,
            },
            status=ResearchStepStatus.COMPLETED,
        )
        deps.session.add(step)
        await deps.session.commit()

        # Notify progress
        if deps.on_analysis:
            await deps.on_analysis(state.analysis)

        # Decide next step
        if state.analysis.need_more_search and state.current_iteration < state.max_iterations:
            state.current_iteration += 1
            return PlanSearches()

        return GenerateReport()


@dataclass
class GenerateReport(BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]]):
    """Generate the final research report."""

    async def run(
        self, ctx: GraphRunContext[ResearchGraphState, ResearchDeps]
    ) -> End[dict[str, Any]]:
        state = ctx.state
        deps = ctx.deps

        log.info(
            "generating report",
            session_id=state.session_id,
            total_results=len(state.all_results),
        )

        # Emit thinking event
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "generating_report",
                "message": f"📝 正在根据 {len(state.all_results)} 条结果生成研究报告...",
                "iteration": state.current_iteration,
            })

        # Build prompt
        prompt_parts = [f"# Research Report: {state.topic}"]
        prompt_parts.append(f"\nTotal iterations: {state.current_iteration}")
        prompt_parts.append(f"Total results collected: {len(state.all_results)}")

        if state.all_results:
            prompt_parts.append("\n## Collected Sources:\n")
            for i, r in enumerate(state.all_results[:50], 1):
                prompt_parts.append(f"{i}. **{r.title}**")
                prompt_parts.append(f"   - URL: {r.url}")
                if r.snippet:
                    prompt_parts.append(f"   - {r.snippet[:150]}")
                prompt_parts.append("")

        user_prompt = "\n".join(prompt_parts)

        # Generate report using AI
        try:
            model = build_chat_model(deps.settings)
            agent = Agent(
                model,
                output_type=ReportOutput,
                system_prompt=REPORT_SYSTEM_PROMPT,
                retries=2,
            )
            result = await agent.run(user_prompt)
            state.final_report = result.output.report

        except Exception as error:
            log.warning("report generation failed, using fallback", error=str(error))
            # Fallback report
            lines = [
                f"# 研究报告：{state.topic}",
                "",
                f"## 概述",
                f"完成 {state.current_iteration} 轮搜索，共收集 {len(state.all_results)} 条结果。",
                "",
                "## 主要来源",
            ]
            for i, r in enumerate(state.all_results[:20], 1):
                lines.append(f"{i}. [{r.title}]({r.url})")
            state.final_report = "\n".join(lines)

        log.info(
            "report generated",
            session_id=state.session_id,
            report_length=len(state.final_report),
        )

        # Emit thinking event
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "report_complete",
                "message": f"✅ 报告生成完成，共 {len(state.final_report)} 字",
                "iteration": state.current_iteration,
            })

        # Record step
        step = ResearchStep(
            session_id=state.session_id,
            iteration=state.current_iteration,
            type=ResearchStepType.SUMMARY,
            input_data={"total_results": len(state.all_results)},
            output_data={"report_length": len(state.final_report)},
            status=ResearchStepStatus.COMPLETED,
        )
        deps.session.add(step)

        # Update session with final results
        research = await deps.session.get(ResearchSession, state.session_id)
        if research:
            research.status = ResearchStatus.COMPLETED
            research.aggregated_results = [
                {"title": r.title, "url": r.url, "snippet": r.snippet, "source": r.source, "iteration": r.iteration}
                for r in state.all_results
            ]
            research.final_report = state.final_report

        await deps.session.commit()

        return End({
            "session_id": state.session_id,
            "status": "completed",
            "total_results": len(state.all_results),
            "report_length": len(state.final_report),
        })


# =============================================================================
# Graph Definition
# =============================================================================


RESEARCH_GRAPH: Graph[ResearchGraphState, ResearchDeps, dict[str, Any]] = Graph(
    nodes=[PlanSearches, WaitForApproval, ExecuteSearches, AnalyzeResults, GenerateReport]
)


async def run_research_graph(
    session_id: int,
    notebook_id: int,
    topic: str,
    deps: ResearchDeps,
    *,
    max_iterations: int = 4,
) -> dict[str, Any]:
    """Run the research graph and return results.

    Args:
        session_id: Research session ID
        notebook_id: Notebook ID
        topic: Research topic
        deps: Research dependencies
        max_iterations: Maximum number of search iterations

    Returns:
        Dict with session_id, status, total_results, report_length
    """
    state = ResearchGraphState(
        session_id=session_id,
        notebook_id=notebook_id,
        topic=topic,
        max_iterations=max_iterations,
    )

    result = await RESEARCH_GRAPH.run(PlanSearches(), state=state, deps=deps)
    return result.output
