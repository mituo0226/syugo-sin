// 決済ページのJavaScript

// ページ読み込み時の処理
window.addEventListener('load', function() {
  console.log('決済ページ読み込み完了');
  
  // メインコンテンツを表示
  setTimeout(() => {
    const mainContent = document.getElementById('mainContent');
    mainContent.classList.add('show');
  }, 500);
  
  // フォームのイベントリスナーを設定
  setupFormEventListeners();
  
  // URLパラメータから情報を取得
  const urlParams = new URLSearchParams(window.location.search);
  const uid = urlParams.get('uid');
  
  if (uid) {
    console.log('UID:', uid);
    localStorage.setItem('currentUID', uid);
  } else {
    // UIDがない場合は新しく生成
    const newUID = generateUID();
    localStorage.setItem('currentUID', newUID);
    console.log('新しいUIDを生成:', newUID);
  }
});

// フォームのイベントリスナー設定
function setupFormEventListeners() {
  const form = document.getElementById('paymentForm');
  const cardNumber = document.getElementById('cardNumber');
  const expiryDate = document.getElementById('expiryDate');
  const cvv = document.getElementById('cvv');
  const postalCode = document.getElementById('postalCode');
  
  // カード番号のフォーマット
  cardNumber.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    e.target.value = value;
  });
  
  // 有効期限のフォーマット
  expiryDate.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value;
  });
  
  // フォーム送信
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    processPayment();
  });
  
  // Enterキーでの送信
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') {
        e.preventDefault();
        processPayment();
      }
    }
  });
}

// 決済処理
async function processPayment() {
  const paymentButton = document.getElementById('paymentButton');
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const expiryDate = document.getElementById('expiryDate').value;
  const cvv = document.getElementById('cvv').value;
  const postalCode = document.getElementById('postalCode').value;
  
  // バリデーション
  if (!validatePaymentForm(cardNumber, expiryDate, cvv, postalCode)) {
    return;
  }
  
  // ボタンを無効化
  paymentButton.disabled = true;
  paymentButton.innerHTML = `
    <span class="button-icon">⏳</span>
    <span class="button-text">決済処理中...</span>
    <span class="button-subtext">しばらくお待ちください</span>
  `;
  
  // ローディング表示
  showLoading();
  
  try {
    // UIDを取得
    let uid = localStorage.getItem('currentUID');
    if (!uid) {
      uid = generateUID();
      localStorage.setItem('currentUID', uid);
    }
    
    // チケット情報を保存
    const ticketData = {
      type: 'first-time',
      name: '体験チケット',
      price: 100,
      minutes: 5,
      uid: uid,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('selectedTicket', JSON.stringify(ticketData));
    console.log('チケット情報を保存:', ticketData);
    
    // Square決済ページへの遷移
    await redirectToSquarePayment(uid, ticketData);
    
  } catch (error) {
    console.error('決済処理エラー:', error);
    hideLoading();
    showError('決済処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。');
    
    // ボタンを復元
    resetPaymentButton();
  }
}

// フォームバリデーション
function validatePaymentForm(cardNumber, expiryDate, cvv, postalCode) {
  let isValid = true;
  let errorMessage = '';
  
  if (!cardNumber || cardNumber.length < 16) {
    errorMessage = 'カード番号を正しく入力してください。';
    isValid = false;
  } else if (!expiryDate || expiryDate.length < 5) {
    errorMessage = '有効期限を正しく入力してください。';
    isValid = false;
  } else if (!cvv || cvv.length < 3) {
    errorMessage = 'CVCを正しく入力してください。';
    isValid = false;
  } else if (!postalCode) {
    errorMessage = '郵便番号を入力してください。';
    isValid = false;
  }
  
  if (!isValid) {
    showError(errorMessage);
  }
  
  return isValid;
}

// Square決済ページへの遷移
async function redirectToSquarePayment(uid, ticketData) {
  try {
    // まずテスト用APIを試す
    console.log('テスト決済APIを呼び出し中...');
    const response = await fetch('/api/test-payment-link', {
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
      console.log('決済リンク作成結果:', data);
      
      if (data.checkoutUrl) {
        if (data.fallback) {
          console.log('フォールバック決済ページに遷移:', data.checkoutUrl);
        } else {
          console.log('Square決済ページに遷移:', data.checkoutUrl);
        }
        window.location.href = data.checkoutUrl;
        return;
      }
    }
    
    // フォールバック: 直接payment.htmlに遷移
    console.log('フォールバック: payment.htmlに遷移');
    const fallbackUrl = `./payment.html?uid=${uid}&ticketType=${ticketData.type}&price=${ticketData.price}&minutes=${ticketData.minutes}`;
    window.location.href = fallbackUrl;
    
  } catch (error) {
    console.error('決済遷移エラー:', error);
    
    // 最終フォールバック
    console.log('最終フォールバック: payment.htmlに遷移');
    const fallbackUrl = `./payment.html?uid=${uid}&ticketType=${ticketData.type}&price=${ticketData.price}&minutes=${ticketData.minutes}`;
    window.location.href = fallbackUrl;
  }
}

// UID生成
function generateUID() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `user_${timestamp}_${randomStr}`;
}

// ローディング表示
function showLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.classList.add('show');
}

// ローディング非表示
function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.classList.remove('show');
}

// エラー表示
function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  
  errorText.textContent = message;
  errorMessage.classList.add('show');
  
  // 5秒後に自動で非表示
  setTimeout(() => {
    hideError();
  }, 5000);
}

// エラー非表示
function hideError() {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.classList.remove('show');
}

// 決済ボタンを復元
function resetPaymentButton() {
  const paymentButton = document.getElementById('paymentButton');
  paymentButton.disabled = false;
  paymentButton.innerHTML = `
    <span class="button-icon">✨</span>
    <span class="button-text">100円で体験を開始</span>
    <span class="button-subtext">5分間の神秘的な鑑定</span>
  `;
}

// テストカード情報の自動入力
function fillTestCardInfo() {
  document.getElementById('cardNumber').value = '4111 1111 1111 1111';
  document.getElementById('expiryDate').value = '12/25';
  document.getElementById('cvv').value = '111';
  document.getElementById('postalCode').value = '12345';
}

// 開発環境でのデバッグ機能
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // Ctrl+Shift+T でテストカード情報を自動入力
  window.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'T') {
      event.preventDefault();
      fillTestCardInfo();
      console.log('テストカード情報を自動入力しました');
    }
  });
  
  // デバッグ情報をコンソールに出力
  setTimeout(() => {
    console.log('=== 決済ページ デバッグ情報 ===');
    console.log('UID:', localStorage.getItem('currentUID'));
    console.log('選択されたチケット:', localStorage.getItem('selectedTicket'));
    console.log('ユーザーデータ:', localStorage.getItem('userData'));
    console.log('Ctrl+Shift+T でテストカード情報を自動入力できます');
    console.log('============================');
  }, 1000);
}

// ページ離脱時の処理
window.addEventListener('beforeunload', function() {
  hideLoading();
  hideError();
});

// エラーハンドリング
window.addEventListener('error', function(event) {
  console.error('JavaScript エラー:', event.error);
  hideLoading();
  showError('予期しないエラーが発生しました。ページを再読み込みしてください。');
});

// 未処理のPromise rejectionをキャッチ
window.addEventListener('unhandledrejection', function(event) {
  console.error('未処理のPromise rejection:', event.reason);
  hideLoading();
  showError('処理中にエラーが発生しました。');
  event.preventDefault();
});

// フォーカス管理
document.addEventListener('DOMContentLoaded', function() {
  // 最初の入力フィールドにフォーカス
  setTimeout(() => {
    const firstInput = document.getElementById('cardNumber');
    if (firstInput) {
      firstInput.focus();
    }
  }, 1000);
});

// レスポンシブ対応
function handleResize() {
  const isMobile = window.innerWidth <= 768;
  const formRow = document.querySelector('.form-row');
  
  if (isMobile && formRow) {
    formRow.style.gridTemplateColumns = '1fr';
  } else if (formRow) {
    formRow.style.gridTemplateColumns = '1fr 1fr';
  }
}

window.addEventListener('resize', handleResize);
handleResize(); // 初期実行
