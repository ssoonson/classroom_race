// 시작 파일. 앱 전체를 불러오다 실패하면 빈 화면 대신 안내를 보여 줍니다.
import('./app.js').catch((err) => {
  console.error(err);
  const banner = document.getElementById('threeError');
  banner.hidden = false;
  banner.textContent =
    '게임 파일을 불러오지 못했습니다. index.html을 더블클릭하지 말고 웹 서버로 여세요(README의 "실행" 참고). ' +
    'js 폴더가 함께 올라갔는지도 확인하세요. — ' + err.message;
});
