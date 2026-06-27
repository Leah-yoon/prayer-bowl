# 기도 빈그릇

기도제목을 넘기며 기도 기록을 남기는 작은 웹앱입니다.

## GitHub Pages 배포

1. GitHub에서 새 repository를 만듭니다.
2. 아래 파일과 폴더를 업로드합니다.
   - `index.html`
   - `styles.css`
   - `app.js`
   - `apps-script/`
   - `.gitignore`
   - `README.md`
3. Repository의 `Settings > Pages`로 이동합니다.
4. `Build and deployment`에서 `Deploy from a branch`를 선택합니다.
5. Branch는 `main`, folder는 `/root`로 선택하고 저장합니다.
6. 잠시 기다리면 Pages 주소가 생깁니다.

## Google Sheets

`app.js`의 `SHEET_API_URL`에 Apps Script Web app URL이 들어 있으면 구글 시트와 동기화됩니다.

현재 Apps Script는 아래 시트를 사용합니다.

- `기도제목`
- `기도기록`

## 주의

GitHub Pages로 올린 웹앱 주소를 아는 사람은 기록을 열람하거나 저장할 수 있습니다. 개인용이면 주소를 공개하지 않는 방식으로 사용하세요.
