"""Research graph implementation using pydantic-graph."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext

from cl_logs.logging import get_logger

from crystalith.shared.agents.models import build_chat_model
from crystalith.shared.db import ResearchSession, ResearchStep
from crystalith.shared.types import ResearchStatus, ResearchStepStatus, ResearchStepType

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
Engine options: Web. Priority: 1=high, 2=medium, 3=low."""


ANALYSIS_SYSTEM_PROMPT = """You are a research analyst evaluating search results.
Analyze the results for coverage and relevance to the topic.
Return JSON with:
- summary: Brief summary of findings
- coverage_estimate: 0.0-1.0 how well results cover the topic
- need_more_search: true if more searches would help
- suggested_queries: List of suggested follow-up queries if needed"""


REPORT_SYSTEM_PROMPT = """You are an expert research analyst writing a comprehensive research report.

Your report should be well-structured, insightful, and actionable. Follow this template:

## Report Structure:

1. **Executive Summary** (2-3 sentences)
   - Key findings and main takeaway

2. **Background & Context**
   - Why this topic matters
   - Current landscape

3. **Key Findings** (3-5 main points)
   - Each finding with supporting evidence
   - Include source references [1], [2], etc.

4. **Analysis & Insights**
   - Patterns and trends observed
   - Implications and significance

5. **Recommendations** (if applicable)
   - Actionable next steps
   - Areas for further research

6. **References**
   - Numbered list of sources cited

## Guidelines:
- Write in clear, professional language
- Use Markdown formatting (headers, lists, bold, links)
- Be objective and evidence-based
- Cite sources using [n] notation
- Keep the report focused and concise (500-1500 words)
- Write in the same language as the research topic"""


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
            research.current_iteration = state.current_iteration
            await deps.session.commit()

        # Notify progress
        if deps.on_plan_ready:
            await deps.on_plan_ready(state.search_plan)

        # For now, go directly to execute (Phase 3 will add WaitForApproval)
        state.waiting_for_user = True
        return WaitForApproval()


@dataclass
class WaitForApproval(BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]]):
    """Wait for user to approve/modify the search plan.

    This node implements Human-in-the-loop by polling the database for user actions.
    The user can:
    - approve: Continue with the current search plan
    - modify: Use a modified search plan
    - skip: Skip to the next iteration
    - finish: End research and generate report
    """

    async def run(
        self, ctx: GraphRunContext[ResearchGraphState, ResearchDeps]
    ) -> "ExecuteSearches | AnalyzeResults | GenerateReport":
        import asyncio

        state = ctx.state
        deps = ctx.deps

        log.info(
            "waiting for user approval",
            session_id=state.session_id,
            iteration=state.current_iteration,
        )

        # Emit waiting event
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "waiting_user",
                "message": "⏳ 等待您确认搜索计划...",
                "iteration": state.current_iteration,
            })

        # Poll for user action
        poll_interval = 0.5  # 500ms
        max_wait_time = 600  # 10 minutes
        waited = 0

        while waited < max_wait_time:
            await asyncio.sleep(poll_interval)
            waited += poll_interval

            # Refresh session to get latest status
            research = await deps.session.get(ResearchSession, state.session_id)
            if not research:
                log.error("research session not found", session_id=state.session_id)
                return GenerateReport()
            # Ensure we see latest status/steps from other sessions.
            deps.session.expire(research)
            await deps.session.refresh(research)
            _ = research.steps

            # Check if session was cancelled
            if research.status == ResearchStatus.CANCELLED:
                log.info("research cancelled by user", session_id=state.session_id)
                return GenerateReport()

            # Check if user has taken action (status changed from WAITING_USER)
            if research.status != ResearchStatus.WAITING_USER:
                # Find the latest user input step
                user_steps = [
                    s for s in research.steps
                    if s.type == ResearchStepType.USER_INPUT
                    and s.iteration == state.current_iteration
                ]

                if user_steps:
                    latest_step = user_steps[-1]
                    action = latest_step.input_data.get("action") if latest_step.input_data else None

                    log.info(
                        "user action received",
                        session_id=state.session_id,
                        action=action,
                        iteration=state.current_iteration,
                    )

                    if action == "skip":
                        if deps.on_thinking:
                            await deps.on_thinking({
                                "type": "user_action",
                                "message": "⏭️ 用户选择跳过本轮",
                                "iteration": state.current_iteration,
                            })
                        if state.current_iteration >= state.max_iterations:
                            return GenerateReport()
                        state.current_iteration += 1
                        return AnalyzeResults()

                    if action == "finish":
                        if deps.on_thinking:
                            await deps.on_thinking({
                                "type": "user_action",
                                "message": "✅ 用户选择结束研究",
                                "iteration": state.current_iteration,
                            })
                        return GenerateReport()

                    if action == "cancel":
                        if deps.on_thinking:
                            await deps.on_thinking({
                                "type": "user_action",
                                "message": "🛑 用户取消了研究",
                                "iteration": state.current_iteration,
                            })
                        return GenerateReport()

                    if action == "modify":
                        # Get modified plan from step data
                        modified_plan = latest_step.input_data.get("plan") if latest_step.input_data else None
                        if modified_plan:
                            state.search_plan = SearchPlan(
                                queries=[
                                    SearchQuery(**q) for q in modified_plan.get("queries", [])
                                ],
                                reasoning=modified_plan.get("reasoning", "用户修改的计划"),
                            )
                            if deps.on_thinking:
                                await deps.on_thinking({
                                    "type": "user_action",
                                    "message": f"✏️ 用户修改了搜索计划，共 {len(state.search_plan.queries)} 个查询",
                                    "iteration": state.current_iteration,
                                })

                    # Default: approve
                    if deps.on_thinking:
                        await deps.on_thinking({
                            "type": "user_action",
                            "message": "👍 用户确认搜索计划",
                            "iteration": state.current_iteration,
                        })

                # Continue with search
                state.waiting_for_user = False
                return ExecuteSearches()

        # Timeout - auto-approve and continue
        log.warning(
            "user approval timeout, auto-approving",
            session_id=state.session_id,
            iteration=state.current_iteration,
        )
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "timeout",
                "message": "⏰ 等待超时，自动继续执行",
                "iteration": state.current_iteration,
            })

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

        # Execute searches with concurrency control
        import asyncio
        max_concurrent = 3  # Limit concurrent searches to avoid rate limiting

        async def execute_single_search(sq: SearchQuery) -> list[SearchResult]:
            """Execute a single search query."""
            results = []
            try:
                raw_results = await deps.searcher.search(sq.query, mode=sq.engine)
                for r in raw_results:
                    sr = SearchResult(
                        title=r.title,
                        url=r.url,
                        snippet=r.snippet,
                        source=r.engine or sq.engine,
                        iteration=state.current_iteration,
                    )
                    results.append(sr)
            except Exception as e:
                log.warning("search query failed", query=sq.query, error=str(e))
            return results

        # Process queries in batches
        queries = state.search_plan.queries
        for batch_start in range(0, len(queries), max_concurrent):
            batch = queries[batch_start:batch_start + max_concurrent]
            batch_tasks = [execute_single_search(sq) for sq in batch]
            batch_results = await asyncio.gather(*batch_tasks)

            for results in batch_results:
                for sr in results:
                    state.current_results.append(sr)
                    if deps.on_search_result:
                        await deps.on_search_result(sr)

        # Log completion
        log.info(
            "all searches completed",
            session_id=state.session_id,
            iteration=state.current_iteration,
            total_results=len(state.current_results),
        )

        # Emit thinking event for completion
        if deps.on_thinking:
            await deps.on_thinking({
                "type": "search_complete",
                "message": f"🔎 搜索完成，共找到 {len(state.current_results)} 条结果",
                "iteration": state.current_iteration,
                "count": len(state.current_results),
            })

        # Deduplicate by URL and similar titles
        seen_urls: set[str] = {r.url for r in state.all_results}
        seen_titles: set[str] = {r.title.lower().strip() for r in state.all_results}

        def normalize_url(url: str) -> str:
            """Normalize URL for deduplication (remove trailing slashes, www prefix, etc.)"""
            url = url.lower().strip()
            # Remove trailing slash
            url = url.rstrip('/')
            # Remove www prefix
            if '://www.' in url:
                url = url.replace('://www.', '://')
            return url

        def is_similar_title(title: str, seen: set[str], threshold: float = 0.85) -> bool:
            """Check if title is similar to any seen title using simple ratio."""
            title_lower = title.lower().strip()
            if title_lower in seen:
                return True
            # Simple similarity check - if title is very short, require exact match
            if len(title_lower) < 20:
                return title_lower in seen
            # For longer titles, check if most words overlap
            title_words = set(title_lower.split())
            for seen_title in seen:
                seen_words = set(seen_title.split())
                if not title_words or not seen_words:
                    continue
                overlap = len(title_words & seen_words)
                max_len = max(len(title_words), len(seen_words))
                if max_len > 0 and overlap / max_len >= threshold:
                    return True
            return False

        # Normalize existing URLs
        seen_normalized_urls = {normalize_url(r.url) for r in state.all_results}

        new_results = []
        for r in state.current_results:
            normalized_url = normalize_url(r.url)
            if normalized_url in seen_normalized_urls:
                continue
            if is_similar_title(r.title, seen_titles):
                continue
            new_results.append(r)
            seen_normalized_urls.add(normalized_url)
            seen_titles.add(r.title.lower().strip())

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

        # Persist aggregated results so sessions can resume mid-run.
        research = await deps.session.get(ResearchSession, state.session_id)
        if research:
            research.aggregated_results = [
                {
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet,
                    "source": r.source,
                    "iteration": r.iteration,
                }
                for r in state.all_results
            ]
            research.current_iteration = state.current_iteration
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

        # If the user cancelled, stop without generating or overwriting status.
        research = await deps.session.get(ResearchSession, state.session_id)
        if research and research.status == ResearchStatus.CANCELLED:
            log.info("research cancelled, skipping report", session_id=state.session_id)
            return End({
                "session_id": state.session_id,
                "status": ResearchStatus.CANCELLED.value,
                "total_results": len(state.all_results),
                "report_length": 0,
            })

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
            research.current_iteration = state.current_iteration
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


def _parse_search_plan(plan_data: dict[str, Any], fallback_iteration: int) -> SearchPlan | None:
    queries_raw = plan_data.get("queries") if isinstance(plan_data, dict) else None
    if not isinstance(queries_raw, list):
        return None

    queries: list[SearchQuery] = []
    for query_data in queries_raw:
        if not isinstance(query_data, dict):
            continue
        query_text = str(query_data.get("query") or "").strip()
        if not query_text:
            continue
        try:
            priority = int(query_data.get("priority", 1))
        except (TypeError, ValueError):
            priority = 1
        queries.append(
            SearchQuery(
                query=query_text,
                engine=str(query_data.get("engine") or "Web"),
                priority=priority,
                reason=str(query_data.get("reason") or ""),
            )
        )

    if not queries:
        return None

    try:
        iteration = int(plan_data.get("iteration") or fallback_iteration)
    except (TypeError, ValueError):
        iteration = fallback_iteration

    try:
        estimated_results = int(plan_data.get("estimated_results", 10))
    except (TypeError, ValueError):
        estimated_results = 10

    return SearchPlan(
        iteration=iteration,
        queries=queries,
        reasoning=str(plan_data.get("reasoning") or ""),
        estimated_results=estimated_results,
    )


def _extract_plan_from_steps(
    steps: list[ResearchStep] | None,
    iteration: int,
) -> SearchPlan | None:
    if not steps:
        return None

    # Prefer user-modified plan if present for this iteration.
    for step in reversed(steps):
        if step.iteration != iteration:
            continue
        if step.type == ResearchStepType.USER_INPUT and step.input_data:
            action = step.input_data.get("action")
            if action == "modify" and isinstance(step.input_data.get("plan"), dict):
                plan = _parse_search_plan(step.input_data["plan"], iteration)
                if plan:
                    return plan

    # Fall back to the latest generated plan for this iteration.
    for step in reversed(steps):
        if step.iteration != iteration:
            continue
        if step.type == ResearchStepType.PLAN and step.output_data:
            plan = _parse_search_plan(step.output_data, iteration)
            if plan:
                return plan

    return None


def _build_state_from_session(research: ResearchSession) -> ResearchGraphState:
    state = ResearchGraphState(
        session_id=research.id,
        notebook_id=research.notebook_id,
        topic=research.topic,
        current_iteration=research.current_iteration,
        max_iterations=research.max_iterations,
    )

    if research.aggregated_results:
        for raw in research.aggregated_results:
            if not isinstance(raw, dict):
                continue
            state.all_results.append(
                SearchResult(
                    title=str(raw.get("title") or ""),
                    url=str(raw.get("url") or ""),
                    snippet=str(raw.get("snippet") or ""),
                    source=str(raw.get("source") or ""),
                    iteration=int(raw.get("iteration") or research.current_iteration),
                )
            )

    state.search_plan = _extract_plan_from_steps(research.steps, research.current_iteration)
    return state


def _start_node_for_status(
    status: ResearchStatus,
    *,
    has_plan: bool,
) -> BaseNode[ResearchGraphState, ResearchDeps, dict[str, Any]] | None:
    if status == ResearchStatus.PLANNING:
        return PlanSearches()
    if status == ResearchStatus.WAITING_USER:
        return WaitForApproval() if has_plan else PlanSearches()
    if status == ResearchStatus.SEARCHING:
        return ExecuteSearches() if has_plan else PlanSearches()
    if status == ResearchStatus.ANALYZING:
        return AnalyzeResults()
    if status in (ResearchStatus.COMPLETED, ResearchStatus.CANCELLED):
        return None
    return PlanSearches()


async def run_research_graph_from_session(
    research: ResearchSession,
    deps: ResearchDeps,
) -> dict[str, Any]:
    """Resume research graph based on existing session state."""
    start_node = _start_node_for_status(
        research.status,
        has_plan=bool(_extract_plan_from_steps(research.steps, research.current_iteration)),
    )
    if start_node is None:
        return {
            "session_id": research.id,
            "status": research.status.value,
            "total_results": len(research.aggregated_results or []),
            "report_length": len(research.final_report or ""),
        }

    state = _build_state_from_session(research)
    result = await RESEARCH_GRAPH.run(start_node, state=state, deps=deps)
    return result.output


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
