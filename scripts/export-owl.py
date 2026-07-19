#!/usr/bin/env python3
"""
KRDS 온톨로지 OWL/RDF 변환 스크립트 (Phase 1+2)

데이터 소스:
  - jargon-dictionary.json  → 293개 행정어 인스턴스
  - agency-issues.json      → 기관-용어 usedBy 관계
  - krds-lint.js (PATTERN_RULES 메타)

출력:
  - krds-ontology.owl  (RDF/XML — Microsoft Ontology Playground에서 Import 가능)
  - ontology-report.json  (요약 리포트)

OWL 스키마:
  Classes:
    AdministrativeJargon  — 행정어 (금지어)
    Replacement           — 대체어
    Principle             — KRDS 3대 원칙
    Agency                — 기관
    PatternRule           — 패턴 규칙 (regex 기반)
    JargonCategory        — 용어 카테고리

  Object Properties:
    hasReplacement  AdministrativeJargon → Replacement
    violatesPrinciple  AdministrativeJargon → Principle
    usedByAgency    AdministrativeJargon → Agency
    belongsToCategory  AdministrativeJargon → JargonCategory
    detectedByRule  AdministrativeJargon → PatternRule

  Datatype Properties:
    severity        error | warning | info
    bannedForm      금지 표현 문자열
    altForm         권장 대체어 문자열
    issueCount      기관에서 발견된 이슈 수
"""

import json
import re
import os
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom
from collections import Counter, defaultdict

# ─── 경로 설정 ─────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JARGON_PATH = os.path.join(BASE, 'jargon-dictionary.json')
ISSUES_PATH = os.path.join(BASE, 'agency-issues.json')
OUT_OWL     = os.path.join(BASE, 'krds-ontology.owl')
OUT_JSON    = os.path.join(BASE, 'ontology-report.json')

# ─── 네임스페이스 ───────────────────────────────────────────────────────────────
NS_KRDS = 'http://krds.go.kr/ontology/uxwriting#'
NS_OWL  = 'http://www.w3.org/2002/07/owl#'
NS_RDF  = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
NS_RDFS = 'http://www.w3.org/2000/01/rdf-schema#'
NS_XSD  = 'http://www.w3.org/2001/XMLSchema#'

# ─── 슬러그 변환 ───────────────────────────────────────────────────────────────
def slugify(text):
    """한글 포함 문자열을 OWL ID로 변환"""
    text = str(text).strip()
    # 한글은 유니코드 이스케이프 없이 직접 사용 (OWL은 UTF-8 지원)
    text = re.sub(r'[^\w가-힣ㄱ-ㅎㅏ-ㅣ]', '_', text)
    text = re.sub(r'_+', '_', text).strip('_')
    return text or 'unknown'

# ─── KRDS 고정 데이터 ────────────────────────────────────────────────────────────
PRINCIPLES = {
    '무번역':      {'label': '무번역 원칙', 'desc': '행정어·한자어를 시민이 이해하는 언어로 전환'},
    '정보핵심화':   {'label': '정보핵심화 원칙', 'desc': '불필요한 수식·중복을 제거하고 핵심만 남김'},
    '심리적안전망': {'label': '심리적안전망 원칙', 'desc': '오류·경고·안내에 상황+원인+행동 3단 구조'},
}

CAT_TO_PRINCIPLE = {
    '행정 관습어': '무번역',
    '전문 용어':   '무번역',
    '과도한 수식': '정보핵심화',
    '이중 부정':   '정보핵심화',
    '과도한 경어': '정보핵심화',
}

AGENCIES = {
    'jeongbu24': {'label': '정부24',               'url': 'https://www.gov.kr'},
    'hometax':   {'label': '홈택스',               'url': 'https://www.hometax.go.kr'},
    'efamily':   {'label': '전자가족관계등록시스템',  'url': 'https://efamily.scourt.go.kr'},
}

SEVERITY_MAP = {
    '행정 관습어': 'error',
    '전문 용어':   'error',
    '과도한 수식': 'warning',
    '이중 부정':   'error',
    '과도한 경어': 'warning',
}

# ─── 데이터 로드 ─────────────────────────────────────────────────────────────────
print("📂 데이터 로딩...")
jargon_data  = json.load(open(JARGON_PATH, encoding='utf-8'))
issues_data  = json.load(open(ISSUES_PATH, encoding='utf-8'))

entries = jargon_data['entries']
issues  = issues_data['issues']

# 기관별 용어 등장 빈도 수집
agency_term_freq = defaultdict(lambda: defaultdict(int))
for iss in issues:
    agency = iss.get('agency', '')
    text = iss.get('original', '') + ' ' + iss.get('title', '')
    for entry in entries:
        banned = entry.get('banned', '')
        if banned and banned in text:
            agency_term_freq[agency][banned] += 1

print(f"  사전: {len(entries)}개 항목")
print(f"  기관 이슈: {len(issues)}개")
total_links = sum(len(v) for v in agency_term_freq.values())
print(f"  기관-용어 연결: {total_links}개")

# ─── OWL RDF/XML 생성 ───────────────────────────────────────────────────────────
print("\n🔧 OWL/RDF 생성 중...")

# XML 네임스페이스 선언
rdf = Element('rdf:RDF', {
    'xmlns':      NS_KRDS,
    'xmlns:rdf':  NS_RDF,
    'xmlns:rdfs': NS_RDFS,
    'xmlns:owl':  NS_OWL,
    'xmlns:xsd':  NS_XSD,
    'xml:base':   NS_KRDS,
})

# ── 온톨로지 헤더 ──
ont = SubElement(rdf, 'owl:Ontology', {'rdf:about': NS_KRDS.rstrip('#')})
SubElement(ont, 'rdfs:label').text = 'KRDS UX Writing 행정어 온톨로지'
SubElement(ont, 'rdfs:comment').text = 'KRDS 3대 원칙(무번역·정보핵심화·심리적안전망) 기반 공공기관 행정어 지식 그래프'
SubElement(ont, 'owl:versionInfo').text = '1.0.0'

# ── 클래스 정의 ──
CLASSES = [
    ('AdministrativeJargon', '행정어', '공공기관에서 사용되는 행정어·전문어·금지 표현'),
    ('Replacement',          '대체어', 'KRDS 권장 대체 표현'),
    ('Principle',            'KRDS 원칙', 'KRDS UX Writing 3대 원칙'),
    ('Agency',               '기관', '공공기관 (정부24, 홈택스 등)'),
    ('PatternRule',          '패턴 규칙', '정규식 기반 문체 패턴 규칙'),
    ('JargonCategory',       '용어 카테고리', '행정어 유형 분류'),
]

for cls_id, label, comment in CLASSES:
    cls = SubElement(rdf, 'owl:Class', {'rdf:about': f'{NS_KRDS}{cls_id}'})
    SubElement(cls, 'rdfs:label', {'xml:lang': 'ko'}).text = label
    SubElement(cls, 'rdfs:comment', {'xml:lang': 'ko'}).text = comment

# ── Object Properties ──
OBJ_PROPS = [
    ('hasReplacement',     '권장 대체어',   'AdministrativeJargon', 'Replacement'),
    ('violatesPrinciple',  '위반 원칙',     'AdministrativeJargon', 'Principle'),
    ('usedByAgency',       '사용 기관',     'AdministrativeJargon', 'Agency'),
    ('belongsToCategory',  '속하는 카테고리','AdministrativeJargon', 'JargonCategory'),
    ('detectedByRule',     '감지 규칙',     'AdministrativeJargon', 'PatternRule'),
]

for prop_id, label, domain, range_ in OBJ_PROPS:
    prop = SubElement(rdf, 'owl:ObjectProperty', {'rdf:about': f'{NS_KRDS}{prop_id}'})
    SubElement(prop, 'rdfs:label', {'xml:lang': 'ko'}).text = label
    SubElement(prop, 'rdfs:domain', {'rdf:resource': f'{NS_KRDS}{domain}'})
    SubElement(prop, 'rdfs:range',  {'rdf:resource': f'{NS_KRDS}{range_}'})

# ── Datatype Properties ──
DT_PROPS = [
    ('severity',   '심각도',  'xsd:string'),
    ('bannedForm', '금지 표현', 'xsd:string'),
    ('altForm',    '대체 표현', 'xsd:string'),
    ('issueCount', '이슈 수',  'xsd:integer'),
]

for prop_id, label, dtype in DT_PROPS:
    prop = SubElement(rdf, 'owl:DatatypeProperty', {'rdf:about': f'{NS_KRDS}{prop_id}'})
    SubElement(prop, 'rdfs:label', {'xml:lang': 'ko'}).text = label
    SubElement(prop, 'rdfs:range', {'rdf:resource': f'{NS_XSD}{dtype.split(":")[1]}'})

# ── KRDS 원칙 인스턴스 ──
for pid, pinfo in PRINCIPLES.items():
    inst = SubElement(rdf, 'owl:NamedIndividual', {'rdf:about': f'{NS_KRDS}Principle_{slugify(pid)}'})
    SubElement(inst, 'rdf:type', {'rdf:resource': f'{NS_KRDS}Principle'})
    SubElement(inst, 'rdfs:label', {'xml:lang': 'ko'}).text = pinfo['label']
    SubElement(inst, 'rdfs:comment', {'xml:lang': 'ko'}).text = pinfo['desc']

# ── 카테고리 인스턴스 ──
categories = list({e['cat'] for e in entries if 'cat' in e})
for cat in categories:
    inst = SubElement(rdf, 'owl:NamedIndividual', {'rdf:about': f'{NS_KRDS}Category_{slugify(cat)}'})
    SubElement(inst, 'rdf:type', {'rdf:resource': f'{NS_KRDS}JargonCategory'})
    SubElement(inst, 'rdfs:label', {'xml:lang': 'ko'}).text = cat

# ── 기관 인스턴스 ──
for agency_key, ainfo in AGENCIES.items():
    inst = SubElement(rdf, 'owl:NamedIndividual', {'rdf:about': f'{NS_KRDS}Agency_{agency_key}'})
    SubElement(inst, 'rdf:type', {'rdf:resource': f'{NS_KRDS}Agency'})
    SubElement(inst, 'rdfs:label', {'xml:lang': 'ko'}).text = ainfo['label']
    SubElement(inst, 'rdfs:seeAlso', {'rdf:resource': ainfo['url']})

# ── 행정어 인스턴스 ──
jargon_count = 0
for i, entry in enumerate(entries):
    banned = entry.get('banned', '')
    if not banned:
        # bannedRegex 항목은 별도 처리
        banned_rgx = entry.get('bannedRegex')
        if banned_rgx:
            banned = f'regex_{i}'
        else:
            continue

    alt  = entry.get('alt', '')
    cat  = entry.get('cat', '기타')
    slug = slugify(banned)
    inst_id = f'{NS_KRDS}Jargon_{slug}'

    inst = SubElement(rdf, 'owl:NamedIndividual', {'rdf:about': inst_id})
    SubElement(inst, 'rdf:type', {'rdf:resource': f'{NS_KRDS}AdministrativeJargon'})
    SubElement(inst, 'rdfs:label', {'xml:lang': 'ko'}).text = banned
    SubElement(inst, f'{{{NS_KRDS}}}bannedForm').text = banned
    SubElement(inst, f'{{{NS_KRDS}}}severity').text = SEVERITY_MAP.get(cat, 'warning')

    # 대체어 관계
    if alt:
        alt_id = f'{NS_KRDS}Replacement_{slugify(alt[:30])}'
        SubElement(inst, f'{{{NS_KRDS}}}hasReplacement', {'rdf:resource': alt_id})
        # 대체어 인스턴스 (간략화: 별도 요소 생략, label만)
        SubElement(inst, 'rdfs:comment', {'xml:lang': 'ko'}).text = f'대체어: {alt}'

    # 카테고리 관계
    SubElement(inst, f'{{{NS_KRDS}}}belongsToCategory',
               {'rdf:resource': f'{NS_KRDS}Category_{slugify(cat)}'})

    # 원칙 위반 관계
    principle = CAT_TO_PRINCIPLE.get(cat)
    if principle:
        SubElement(inst, f'{{{NS_KRDS}}}violatesPrinciple',
                   {'rdf:resource': f'{NS_KRDS}Principle_{slugify(principle)}'})

    # 기관 사용 관계
    for agency_key, term_freq in agency_term_freq.items():
        if banned in term_freq:
            SubElement(inst, f'{{{NS_KRDS}}}usedByAgency',
                       {'rdf:resource': f'{NS_KRDS}Agency_{agency_key}'})
            count_el = SubElement(inst, f'{{{NS_KRDS}}}issueCount')
            count_el.text = str(term_freq[banned])

    jargon_count += 1

# ─── OWL 파일 저장 ───────────────────────────────────────────────────────────────
print(f"\n💾 저장 중...")
xml_str = tostring(rdf, encoding='unicode')
dom = minidom.parseString(f'<?xml version="1.0" encoding="UTF-8"?>{xml_str}')
pretty_xml = dom.toprettyxml(indent='  ', encoding=None)
# XML 선언 중복 제거
pretty_xml = '\n'.join(pretty_xml.split('\n')[1:]) if pretty_xml.startswith('<?xml') else pretty_xml

with open(OUT_OWL, 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write(pretty_xml)

# ─── JSON 리포트 ─────────────────────────────────────────────────────────────────
report = {
    'version': '1.0.0',
    'generated': __import__('datetime').datetime.now().isoformat(),
    'stats': {
        'classes': len(CLASSES),
        'object_properties': len(OBJ_PROPS),
        'datatype_properties': len(DT_PROPS),
        'principles': len(PRINCIPLES),
        'agencies': len(AGENCIES),
        'categories': len(categories),
        'jargon_instances': jargon_count,
        'agency_term_links': total_links,
    },
    'ontology_iri': NS_KRDS.rstrip('#'),
    'playground_import': 'https://microsoft.github.io/Ontology-Playground/#/designer',
}

with open(OUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"  → {OUT_OWL}")
print(f"  → {OUT_JSON}")
print(f"\n✅ 완료!")
print(f"   클래스: {len(CLASSES)}개")
print(f"   속성: {len(OBJ_PROPS)+len(DT_PROPS)}개 ({len(OBJ_PROPS)} object + {len(DT_PROPS)} datatype)")
print(f"   행정어 인스턴스: {jargon_count}개")
print(f"   기관-용어 연결: {total_links}개")
print(f"\n📋 다음 단계:")
print(f"   1. {OUT_OWL} 파일을 Ontology Playground에 Import")
print(f"   2. https://microsoft.github.io/Ontology-Playground/#/designer")
print(f"   3. 'Import' 버튼 → '{os.path.basename(OUT_OWL)}' 선택")
