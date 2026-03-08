import type { ReactNode } from "react";
import { TamboRegistryProvider, type TamboComponent } from "@tambo-ai/react";
import { z } from "zod";

import AnswerCard from "../../domains/messages/components/AnswerCard";
import BarChartCard from "../../domains/messages/components/BarChartCard";
import DataTableCard from "../../domains/messages/components/DataTableCard";

const components: TamboComponent[] = [
  {
    name: "AnswerCard",
    description: "Renders an answer as markdown text.",
    component: AnswerCard,
    propsSchema: z.object({
      markdown: z.string(),
    }),
  },
  {
    name: "BarChartCard",
    description: "Renders a simple horizontal bar chart.",
    component: BarChartCard,
    propsSchema: z.object({
      title: z.string(),
      unit: z.string().nullable().optional(),
      items: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
        }),
      ),
    }),
  },
  {
    name: "DataTableCard",
    description: "Renders a tabular dataset.",
    component: DataTableCard,
    propsSchema: z.object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
    }),
  },
];

export default function TamboProvider({ children }: { children: ReactNode }) {
  return <TamboRegistryProvider components={components}>{children}</TamboRegistryProvider>;
}
