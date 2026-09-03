from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable, Image
)
from reportlab.pdfbase.pdfmetrics import stringWidth
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'files' / 'cv-en.pdf'
LOGO = ROOT / 'logo.png'

PAGE_W, PAGE_H = A4
ACCENT = colors.HexColor('#9C5A40')
INK = colors.HexColor('#211C19')
SOFT = colors.HexColor('#6D625D')
PAPER = colors.HexColor('#FBF8F4')
LINE = colors.HexColor('#DED5CE')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CVTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=25, leading=28, textColor=INK, spaceAfter=4))
styles.add(ParagraphStyle(name='CVSub', parent=styles['Normal'], fontName='Helvetica', fontSize=11, leading=16, textColor=SOFT, spaceAfter=9))
styles.add(ParagraphStyle(name='Section', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12.5, leading=15, textColor=ACCENT, spaceBefore=11, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name='BodyCV', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.3, leading=13.2, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name='SmallCV', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.1, leading=11.1, textColor=SOFT, spaceAfter=3))
styles.add(ParagraphStyle(name='ItemTitle', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=9.5, leading=12.5, textColor=INK, spaceAfter=1))
styles.add(ParagraphStyle(name='ItemBody', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.7, leading=12, textColor=SOFT, spaceAfter=5))
styles.add(ParagraphStyle(name='Research', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.1, leading=11, textColor=INK, leftIndent=9, firstLineIndent=-7, spaceAfter=3))
styles.add(ParagraphStyle(name='Footer', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, textColor=SOFT, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Tag', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9, textColor=ACCENT, alignment=TA_CENTER))

profile = (
    'Associate Professor of Educational Technology at the College of Basic Education, '
    'The Public Authority for Applied Education and Training (PAAET), Kuwait, and a visiting '
    'professor at Kuwait University. Author, researcher, consultant, and designer of educational '
    'technology initiatives with work spanning artificial intelligence, digital learning, learning '
    'management systems, youth innovation, and the human dimensions of technology.'
)

education = [
    ('Ph.D. in Education - Educational Technology', 'University of Northern Colorado, Greeley, Colorado - highest distinction and honors.'),
    ('M.A. in Educational Technology', 'University of Northern Colorado - highest distinction and honors.'),
    ('B.Ed. in Educational Technology', 'The Public Authority for Applied Education and Training (PAAET), Kuwait - highest distinction and honors.'),
]

appointments = [
    ('Associate Professor, January 2020 - present', 'College of Basic Education, PAAET, Kuwait.'),
    ('Visiting Professor', 'College of Education, Kuwait University.'),
    ('Assistant Professor, through January 2020', 'College of Basic Education, PAAET, Kuwait.'),
]

advisory = [
    ('Expert and Advisor, Office of the Minister', 'Ministry of Information, Kuwait.'),
    ('Advisor', 'National Council for Culture, Arts and Letters.'),
    ('Advisor', 'Kuwait National Library.'),
    ('Expert and Advisor; General Supervisor of the Muthmir National Program', 'Public Authority for Youth, Kuwait.'),
    ('Advisor, Maker Faire Kuwait', 'Kuwait Investment Company.'),
    ('Trainer and Consultant', 'Makers Academy, Kuwait.'),
]

books = [
    'Educational Technology Encyclopedia',
    'Learning and the Requirements of the Century (Digital Learning)',
    'Gaming and the World of Games',
    'Technology for People with Disabilities',
    'Children and Technology',
    'Artificial Intelligence and Big Data',
    'Smart Schools',
    'Teaching Methods and Educational Technology',
    'The Virtual World',
]

research = [
    'MS Teams Development Application Trends as a Quality Education in Light of the Epidemiological Challenges (COVID-19) in Kuwait.',
    'The Reality of Using Smart Device Applications in Learning by University Students at the College of Basic Education in Kuwait.',
    'Trends of College of Basic Education Students Towards the Use of Photography to Develop Learning Skills in Kuwait.',
    'The Importance of Adopting Learning Management Systems (LMS) to Enhance the Quality of Teaching Among University Professors in Kuwait.',
    'The Role of Technological Creative Photography in Contemporary Education Frameworks in Developing the Knowledge, Skills and Abilities of University Professors at the College of Basic Education in Kuwait.',
    'University Students’ Perceptions at the College of Basic Education Regarding the Use of Interactive Whiteboard Technology in Education in Kuwait.',
    'Perceptions of University Students at the College of Basic Education Toward Implementing Moodle in Managing E-Courses to Enhance Learning in Kuwait.',
    'The Impact of the Working Environment and Learning Science in the Electronic Learning Systems Used in Education.',
    'Investigating the Role of E-Learning Management Systems in the Learning Process from the Point of View of Faculty at the College of Basic Education in Kuwait.',
    'How Important Is the Use of E-Learning Management Systems in Building a Smart University in Kuwait?',
    'The Reality of Using Cloud Computing in University Education from the Point of View of Faculty Members in Kuwait.',
    'The Availability of E-Learning Qualifications Among Faculty Members at the College of Basic Education in Kuwait.',
    'Obstacles to the Employment of Educational Technology for Students with Special Needs from the Point of View of Faculty Members at PAAET.',
    'Faculty Members’ Degree of Awareness of the Augmented Reality Concept at the College of Basic Education, PAAET, Kuwait.',
    'Faculty Attitudes Toward the Use of Educational Technology at the College of Basic Education.',
    'The Effectiveness of Faculty Members’ Use of Multimedia in Higher Education.',
    'The Effectiveness of Web Navigation in Improving Students’ Learning Skills.',
    'The Importance of E-Learning in Acquiring Scientific Research Skills for Undergraduate and Graduate Students.',
]

memberships = [
    'International Society for Technology in Education (ISTE)',
    'Association for Educational Communications and Technology (AECT)',
    'Golden Key International Honour Society',
    'Pi Lambda Theta',
    'United States Distance Learning Association (USDLA)',
    'North American Association for Environmental Education (NAAEE)',
    'Microsoft Innovative Educator (MIE)',
    'Association for Leadership in Education (ALE)',
]

committees = [
    'Higher Committee for Digital Transformation at PAAET.',
    'Research, quality and academic accreditation committees at the College of Basic Education.',
    'Scientific research, scholarships, curriculum development, examinations and scheduling committees in the Educational Technology Department.',
    'Contributor to graduate requirements, program standards, and curriculum development in Educational Technology.',
    'Reviewer and examiner for academic research and international competitions.',
]

projects = [
    ('Academic Scheduling System', 'Co-created a Kuwait-based system that supports colleges and academic departments in building course schedules.'),
    ('Educational Software and Digital Learning', 'Designed and managed educational software, digital learning environments, training programs, and technology-supported curricula.'),
]

workshops = [
    'Educational and learning applications; educational technology; digital manufacturing; gamification tools; Internet of Things; artificial intelligence foundations.',
    'Teamwork, leadership, time management, strategic planning, decision-making, communication, report writing, institutional management, and technological marketing.',
    'Distance teaching, Microsoft Teams and Office 365, OneNote, inclusive classrooms, digital assessment, coding, computational thinking, Minecraft Education, robotics, and learning design.',
    'Youth, family and society themes, including balanced life, mental-health fundamentals, culture, innovation, and responsible technology use.',
]

conferences = [
    'International Conference on Distance Education and Virtual Learning - Milan, Italy.',
    'Communities and Technologies (C&T) - Munich, Germany.',
    'Technology in the World of Education - Kuala Lumpur, Malaysia.',
    'How Technology Can Serve the Educational Process - Dubai, United Arab Emirates.',
    'Technology in the Economy and Institutions - Istanbul, Türkiye.',
    'Speaker at Maker Faire Kuwait, Mini Maker Faire Dubai, and Qatar University conferences.',
]

technical = ['Educational technology and instructional design', 'AI and digital-learning strategy', 'Research design and data analysis', 'SPSS', 'Learning management systems', 'Educational software analysis', 'Video editing', 'Image editing', 'macOS and Windows']


def bullets(items, style='BodyCV'):
    out = []
    for item in items:
        out.append(Paragraph(f'• {item}', styles[style]))
    return out


def item_blocks(items):
    out = []
    for title, detail in items:
        out.append(KeepTogether([Paragraph(title, styles['ItemTitle']), Paragraph(detail, styles['ItemBody'])]))
    return out


def section(title):
    return [Paragraph(title.upper(), styles['Section']), HRFlowable(width='100%', thickness=0.6, color=LINE, spaceAfter=7)]


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18*mm, 13*mm, PAGE_W-18*mm, 13*mm)
    canvas.setFillColor(SOFT)
    canvas.setFont('Helvetica', 7.5)
    canvas.drawString(18*mm, 8.5*mm, 'dr-alfailakawi.com')
    canvas.drawRightString(PAGE_W-18*mm, 8.5*mm, f'Ahmad H. Alfailakawi  |  {doc.page}')
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUT), pagesize=A4,
    rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=18*mm,
    title='Ahmad H. Alfailakawi - Curriculum Vitae',
    author='Ahmad H. Alfailakawi',
    subject='Curriculum Vitae',
)

story = []
logo_flow = Image(str(LOGO), width=22*mm, height=22*mm) if LOGO.exists() else Spacer(1, 1)
name_block = [
    Paragraph('AHMAD H. ALFAILAKAWI', styles['CVTitle']),
    Paragraph('Educational Technology · Artificial Intelligence · Research · Consulting', styles['CVSub']),
    Paragraph('<b>Kuwait</b>  ·  ah.alfailakawi@paaet.edu.kw  ·  dr-alfailakawi.com', styles['SmallCV']),
]
head = Table([[logo_flow, name_block]], colWidths=[28*mm, 129*mm], hAlign='LEFT')
head.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (0,0), 6*mm),
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
]))
story += [head, Spacer(1, 5*mm), Paragraph(profile, styles['BodyCV']), Spacer(1, 2*mm)]

stats = Table([
    [Paragraph('9<br/><font size="7">published books</font>', styles['Tag']), Paragraph('18<br/><font size="7">peer-reviewed papers</font>', styles['Tag']), Paragraph('2010s-present<br/><font size="7">teaching, research and advisory work</font>', styles['Tag'])]
], colWidths=[48*mm, 48*mm, 61*mm])
stats.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F2EAE4')),
    ('BOX', (0,0), (-1,-1), 0.5, LINE),
    ('INNERGRID', (0,0), (-1,-1), 0.5, LINE),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 7),
    ('BOTTOMPADDING', (0,0), (-1,-1), 7),
]))
story += [stats]

story += section('Education') + item_blocks(education)
story += section('Academic Appointments') + item_blocks(appointments)
story += section('Advisory and Public-Service Roles') + item_blocks(advisory)

story.append(PageBreak())
story += section('Books') + bullets(books)
story += section('Doctoral Research')
story += [Paragraph('<b>Education Management and Design System: Use of Internet-based Social Learning Network as a Tool to Support High School Teaching Staff in Kuwait</b>', styles['BodyCV']), Paragraph('Ph.D. in Education, Educational Technology - University of Northern Colorado.', styles['ItemBody'])]
story += section('Selected Professional Projects') + item_blocks(projects)
story += section('Media and Public Writing')
story += bullets([
    'Columnist at Al-Jarida newspaper; formerly wrote for Al-Qabas.',
    'Participant in television and radio programs in Kuwait and abroad on education, technology, and social change.',
    'Founder of dr-alfailakawi.com, a bilingual platform for educational thought, research, publications, media, and public scholarship.',
])

story.append(PageBreak())
story += section('Peer-Reviewed Research')
for idx, title in enumerate(research, 1):
    story.append(Paragraph(f'{idx}. {title}', styles['Research']))

story.append(PageBreak())
story += section('International and Professional Memberships') + bullets(memberships)
story += section('Institutional Committees and Academic Service') + bullets(committees)
story += section('Scientific Visits, Conferences and Keynotes') + bullets(conferences)

story.append(PageBreak())
story += section('Training, Workshops and Professional Development')
story += [Paragraph('Selected areas delivered or completed across Kuwait and internationally:', styles['BodyCV'])] + bullets(workshops)
story += section('Technology and Research Capabilities')
tech_table = Table([[Paragraph(x, styles['SmallCV']) for x in technical[i:i+3]] for i in range(0, len(technical), 3)], colWidths=[52*mm]*3)
tech_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F7F1ED')),
    ('GRID', (0,0), (-1,-1), 0.4, LINE),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('RIGHTPADDING', (0,0), (-1,-1), 6),
]))
story += [tech_table]
story += section('Languages') + bullets(['Arabic - native', 'English - professional working proficiency'])
story += section('Current Digital Profile')
story += [Paragraph('The current, authoritative version of this CV and all publications, research, articles, media appearances, and contact channels are maintained at <b>https://dr-alfailakawi.com</b>.', styles['BodyCV'])]

# Force at least five well-spaced pages without a nearly-empty final page.
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
