'use strict';

// contextIsolation이 켜진 상태에서 로드된다. 렌더러(offline-app/index.html + app.js)는
// 오프라인 규칙 기반 린트 엔진만 사용하며 Node API나 IPC가 전혀 필요 없으므로
// contextBridge로 아무 것도 노출하지 않는다. 빈 preload는 "노출 API 없음"을 명시하기 위함이다.
