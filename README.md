# jelly-lab
뿡

## Jelly Lab

회색 배경 위의 반투명 핑크 젤리를 마우스나 터치로 잡아당기는 Three.js 실험 페이지입니다.

- 드래그 후 놓으면 젤리가 흔들리며 원래 형태로 돌아옵니다.
- Mass feel, Firmness, Internal damping, Surface smoothing으로 움직임을 조절합니다.
- Give it a nudge, Reset 버튼과 Slow drift, Shadow 옵션을 제공합니다.
- 정점과 스프링을 이용한 시각적 근사이며 정밀한 물리 시뮬레이션은 아닙니다.

## 파일

- `index.html`: 페이지 구조와 조절 패널
- `styles.css`: 화면 스타일과 반응형 배치
- `app.js`: Three.js 장면, 젤리 변형, 입력 처리

## 로컬 실행

저장소 폴더에서 Python이 설치되어 있다면 다음 명령을 실행합니다.

```sh
python -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다. 별도 빌드 과정은 없습니다.
Three.js 0.167.1은 unpkg CDN에서, 글꼴은 Google Fonts에서 불러오므로 인터넷 연결이 필요합니다.
WebGL을 지원하는 브라우저를 사용하세요.

## GitHub Pages 설정

공개하려면 저장소 Settings → Pages에서 Deploy from a branch를 선택하고
`main` 브랜치의 `/ (root)`를 지정합니다. 저장소에 파일을 커밋하는 것만으로 Pages가 설정되지는 않습니다.
