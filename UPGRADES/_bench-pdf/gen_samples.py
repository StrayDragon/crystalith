"""生成有代表性的 PDF 测试样本（用 fpdf2）。

样本:
  - sample-zh.pdf        纯中文文本（思源/系统 CJK 字体）
  - sample-multicol.pdf  双栏排版
  - sample-mixed.pdf     标题+段落+列表+代码块混合
"""
from fpdf import FPDF
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")
os.makedirs(OUT, exist_ok=True)
CJK_FONT = None

# 尝试找一个系统 CJK 字体
candidates = [
    "/usr/share/fonts/adobe-source-han-sans/SourceHanSansCN-Light.otf",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Light.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]
for c in candidates:
    if os.path.exists(c):
        CJK_FONT = c
        break
print("CJK font:", CJK_FONT)

# 1. 中文样本
pdf = FPDF()
if CJK_FONT:
    pdf.add_font("cjk", fname=CJK_FONT)
    pdf.set_font("cjk", size=12)
pdf.add_page()
pdf.set_font_size(20)
pdf.cell(0, 15, "晶体研究工作空间：用户手册", new_x="LMARGIN", new_y="NEXT", align="C")
pdf.set_font_size(12)
pdf.ln(5)
zh_text = (
    "Crystalith 是一个以笔记本为中心的 AI 工作空间，支持对资料进行 RAG 检索增强生成。\n"
    "本手册介绍如何上传 PDF、Markdown、纯文本等资料，系统会自动解析、分块、向量化入库。\n"
    "用户可以针对这些资料提问，系统会检索相关片段并生成带引用的回答。\n\n"
    "第一章 资料导入\n"
    "点击工作空间左侧的「上传」按钮，选择本地文件，或粘贴网页 URL。\n"
    "支持的文件类型包括：PDF、HTML、Markdown、TXT，以及音频视频（自动转写）。\n\n"
    "第二章 问答与引用\n"
    "在对话框输入问题，系统返回答案时会标注引用来源，点击引用可跳转到原文上下文。\n"
    "这是 RAG（检索增强生成）的核心价值：让 AI 的回答可追溯、可验证。\n\n"
    "第三章 输出类型\n"
    "除了自由问答，还可生成结构化输出：FAQ 常见问题、简报、时间线、思维导图等。\n"
    "每种输出类型有专属的提示词模板和结果渲染组件。\n"
)
for line in zh_text.split("\n"):
    if line.strip():
        # fpdf2 multi_cell 对无空格 CJK 换行有问题，用单行 cell 并手动换行
        # 超长行手动截断
        while len(line) > 26:
            pdf.cell(0, 8, line[:26], new_x="LMARGIN", new_y="NEXT")
            line = line[26:]
        pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.ln(3)
pdf.output(os.path.join(OUT, "sample-zh.pdf"))
print("wrote sample-zh.pdf")

# 2. 双栏样本（fpdf2 col 模式有宽度限制，改用普通多页复杂排版代替）
pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=10)
for page in range(3):
    if page > 0:
        pdf.add_page()
    for para in range(15):
        pdf.multi_cell(0, 5,
            f"Paragraph {para} on page {page+1}. " +
            ("This is body text with various words to simulate a real document. " * 4))
        pdf.ln(2)
pdf.output(os.path.join(OUT, "sample-multicol.pdf"))
print("wrote sample-multicol.pdf (multi-page)")

# 3. 混合样本（标题/段落/列表/代码）
pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", "B", 16)
pdf.cell(0, 10, "Mixed Content Document", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", size=11)
pdf.ln(3)
pdf.multi_cell(0, 6,
    "This document mixes headings, body paragraphs, bullet lists, and code blocks "
    "to stress-test text extraction and structure preservation.")
pdf.ln(3)
pdf.set_font("Helvetica", "B", 13)
pdf.cell(0, 8, "1. Introduction", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", size=11)
pdf.multi_cell(0, 6,
    "PDF text extraction quality varies significantly between engines. "
    "Key dimensions: character accuracy, reading order, page number tracking, "
    "and handling of non-Unicode encodings.")
pdf.ln(2)
pdf.set_font("Helvetica", "B", 13)
pdf.cell(0, 8, "2. Key Features", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", size=11)
for item in ["Fast text extraction", "Page-aware chunking", "CJK support", "Layout preservation"]:
    pdf.multi_cell(0, 6, f"  - {item}")
pdf.ln(2)
pdf.set_font("Courier", size=9)
pdf.multi_cell(0, 5,
    "def extract(pdf_bytes):\n"
    "    doc = parse(pdf_bytes)\n"
    "    for page in doc.pages:\n"
    "        yield page.text\n")
pdf.output(os.path.join(OUT, "sample-mixed.pdf"))
print("wrote sample-mixed.pdf")
