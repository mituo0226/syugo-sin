// チケット購入ページのJavaScript

// チケット情報のマッピング
const ticketInfo = {
  'first-time': { name: '体験チケット', price: 100, minutes: 5 },
  'standard': { name: 'スタンダードチケット', price: 500, minutes: 5 },
  'plus': { name: 'プラスチケット', price: 700, minutes: 10 },
  'premium': { name: 'プレミアムチケット', price: 2000, minutes: 30 },
  'deluxe': { name: 'デラックスチケット', price: 3000, minutes: 60 }
};

// ページ読み込み時の処理
window.addEventListener('load', function() {
  console.log('チケット購入ページ読み込み完了');
  
  // メインコンテンツを表示
  setTimeout(() => {
    const mainContent = document.getElementById('mainContent');
    mainContent.classList.add('show');
  }, 500);
  
  // URLパラメータから情報を取得
  const urlParams = new URLSearchParams(window.location.search);
  const uid = urlParams.get('uid');
  
  if (uid) {
    console.log('UID:', uid);
    // UIDをlocalStorageに保存（決済後の処理で使用）
    localStorage.setItem('currentUID', uid);
  } else {
    // UIDがない場合は新しく生成
    const newUID = generateUID();
    localStorage.setItem('currentUID', newUID);
    console.log('新しいUIDを生成:', newUID);
  }
});

// チケット購入処理
async function purchaseTicket(ticketType, price, minutes) {
  console.log('チケット購入開始:', { ticketType, price, minutes });
  
  try {
    // 購入情報を表示
    showLoading(`チケット購入処理中...`);
    
    // UIDを取得
    let uid = localStorage.getItem('currentUID');
    if (!uid) {
      uid = generateUID();
      localStorage.setItem('currentUID', uid);
    }
    
    // チケット情報を保存
    const ticketData = {
      type: ticketType,
      name: ticketInfo[ticketType].name,
      price: price,
      minutes: minutes,
      uid: uid,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('selectedTicket', JSON.stringify(ticketData));
    console.log('チケット情報を保存:', ticketData);
    
    // Square決済ページへの遷移
    await redirectToPayment(uid, ticketData);
    
  } catch (error) {
    console.error('チケット購入エラー:', error);
    showError('チケット購入処理中にエラーが発生しました。');
  }
}

// Square決済ページへの遷移
async function redirectToPayment(uid, ticketData) {
  try {
    // Square決済リンクを作成するAPIを呼び出し
    const response = await fetch('/api/create-payment-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: uid,
        ticketType: ticketData.type,
        price: ticketData.price,
        minutes: ticketData.minutes
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('決済リンク作成成功:', data);
      
      if (data.checkoutUrl) {
        // Square決済ページに遷移
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('決済URLが取得できませんでした');
      }
    } else {
      const errorData = await response.json();
      console.error('決済リンク作成エラー:', errorData);
      throw new Error(errorData.error || '決済リンクの作成に失敗しました');
    }
    
  } catch (error) {
    console.error('決済遷移エラー:', error);
    
    // フォールバック: 直接payment.htmlに遷移（テスト用）
    if (error.message.includes('決済リンク')) {
      console.log('フォールバック: payment.htmlに遷移');
      window.location.href = `./payment.html?uid=${uid}&ticketType=${ticketData.type}&price=${ticketData.price}&minutes=${ticketData.minutes}`;
    } else {
      showError('決済処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。');
    }
  }
}

// UID生成
function generateUID() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `user_${timestamp}_${randomStr}`;
}

// ローディング表示
function showLoading(message) {
  hideError();
  
  // ローディング要素を作成または取得
  let loadingElement = document.getElementById('loading');
  if (!loadingElement) {
    loadingElement = document.createElement('div');
    loadingElement.id = 'loading';
    loadingElement.className = 'loading show';
    document.querySelector('.container').appendChild(loadingElement);
  }
  
  loadingElement.textContent = message;
  loadingElement.classList.add('show');
}

// エラー表示
function showError(message) {
  hideLoading();
  
  // エラー要素を作成または取得
  let errorElement = document.getElementById('error');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.id = 'error';
    errorElement.className = 'error show';
    document.querySelector('.container').appendChild(errorElement);
  }
  
  errorElement.textContent = message;
  errorElement.classList.add('show');
  
  // 3秒後にエラーメッセージを自動で非表示
  setTimeout(() => {
    hideError();
  }, 5000);
}

// ローディング非表示
function hideLoading() {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.classList.remove('show');
  }
}

// エラー非表示
function hideError() {
  const errorElement = document.getElementById('error');
  if (errorElement) {
    errorElement.classList.remove('show');
  }
}

// 購入ボタンの無効化/有効化
function setPurchaseButtonsEnabled(enabled) {
  const buttons = document.querySelectorAll('.purchase-button');
  buttons.forEach(button => {
    button.disabled = !enabled;
    if (enabled) {
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    } else {
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
    }
  });
}

// ページ離脱時の処理
window.addEventListener('beforeunload', function() {
  // 必要に応じてデータを保存
  console.log('ページ離脱');
});

// エラーハンドリング
window.addEventListener('error', function(event) {
  console.error('JavaScript エラー:', event.error);
  showError('予期しないエラーが発生しました。ページを再読み込みしてください。');
});

// 未処理のPromise rejectionをキャッチ
window.addEventListener('unhandledrejection', function(event) {
  console.error('未処理のPromise rejection:', event.reason);
  showError('処理中にエラーが発生しました。');
  event.preventDefault();
});

// デバッグ用関数（開発環境でのみ使用）
function debugInfo() {
  console.log('=== デバッグ情報 ===');
  console.log('UID:', localStorage.getItem('currentUID'));
  console.log('選択されたチケット:', localStorage.getItem('selectedTicket'));
  console.log('ユーザーデータ:', localStorage.getItem('userData'));
  console.log('残り時間:', localStorage.getItem('expireAt'));
  console.log('==================');
}

// 開発環境でのデバッグ機能
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // デバッグ情報をコンソールに出力
  setTimeout(debugInfo, 1000);
  
  // キーボードショートカットでデバッグ情報を表示
  window.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'd') {
      event.preventDefault();
      debugInfo();
    }
  });
}
