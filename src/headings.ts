import type { Role } from './model.js';

export type Lang = 'ko';

export type VocabKey = 'purpose' | 'behavior' | 'flow' | 'policies' | 'evidence' | 'questions' | 'documents' | 'terms' | 'related';

export const VOCAB_KEYS: readonly VocabKey[] = [
  'purpose',
  'behavior',
  'flow',
  'policies',
  'evidence',
  'questions',
  'documents',
  'terms',
  'related',
];

// 언어별 제목 어휘. 1단계는 ko만 채운다. 영어판은 en 열을 같은 구조로 더한다.
export const VOCAB: Record<Lang, Record<VocabKey, string>> = {
  ko: {
    purpose: '목적',
    behavior: '현재 동작',
    flow: '흐름',
    policies: '정책',
    evidence: '근거',
    questions: '확인 필요 사항',
    documents: '문서 목록',
    terms: '용어',
    related: '관련 문서',
  },
};

// 역할마다 H2 절이 반드시 있어야 하는 어휘 키(4.4.3 표).
export const REQUIRED_SECTIONS: Record<'overview' | 'detail', VocabKey[]> = {
  overview: ['purpose', 'documents', 'related'],
  detail: ['purpose', 'behavior', 'evidence', 'related'],
};

// 역할마다 어휘 절이 나와야 하는 순서(section-order 규칙). 목록에 없는 키와 키 없는 H2는 순서 검사에서 제외한다.
export const SECTION_ORDER: Record<'overview' | 'detail', VocabKey[]> = {
  overview: ['purpose', 'flow', 'documents', 'terms', 'related'],
  detail: ['purpose', 'behavior', 'flow', 'policies', 'evidence', 'questions', 'related'],
};

// 미확정 정책 마커. lang과 무관하게 항상 인식한다.
export const MARKERS: readonly string[] = ['[확인 필요]', '[needs confirmation]'];

export function isRequiredRole(role: Role): role is 'overview' | 'detail' {
  return role === 'overview' || role === 'detail';
}
