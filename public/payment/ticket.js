// 決済ページのJavaScript

// プランデータ定義
const TICKET_PLANS = [
  {
    id: 'first-time',
    emoji: '🌸',
    name: 'おためしプラン',
    minutes: 5,
    price: 100,
    pricePerMinute: 20,
    description: '初回限定。AIとの相性を試せる。原価提供で体験重視。',
    badge: '初回限定',
    firstTimeOnly: true
  },
  {
    id: 'standard',
    emoji: '🌙',
    name: 'スタンダードプラン',
    minutes: 10,
    price: 500,
    pricePerMinute: 50,
    description: '最も利用される基本プラン。短い相談や恋愛診断向け。',
    firstTimeOnly: false
  },
  {
    id: 'premium',
    emoji: '🔮',
    name: 'プレミアムプラン',
    minutes: 20,
    price: 1000,
    pricePerMinute: 50,
    description: '深めの悩みや複数質問対応。リピーターの中心層。',
    firstTimeOnly: false
  },
  {
    id: 'long',
    emoji: '💎',
    name: 'ロングセッション',
    minutes: 45,
    price: 2000,
    pricePerMinute: 44,
    description: 'じっくり鑑定・複数テーマ相談向け。特別感を演出。',
    firstTimeOnly: false
  },
  {
    id: 'monthly',
    emoji: '☯️',
    name: '月額サブスク',
    minutes: 120,
    price: 4000,
    pricePerMinute: 33,
    description: '常連ユーザー向け。安心して継続できるコスパ設計。',
    badge: '定期鑑定',
    firstTimeOnly: false
  }
];

// 選択されたチケット
let selectedTicket = null;

// ページ読み込み時の処理
window.addEventListener('load', async function() {
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
  
  try {
    // 会員情報を表示
    console.log('=== 会員情報表示開始 ===');
    await displayMemberInfo();
    console.log('会員情報表示完了');
    
    // 購入履歴をチェックして初回購入者かどうかを判定
    console.log('=== 初回購入者チェック開始 ===');
    const isFirstTime = await checkFirstTimeUser();
    console.log('初回購入者チェック完了:', isFirstTime);
    
    // チケットプランを表示
    console.log('=== チケットプラン表示開始 ===');
    displayTicketPlans(isFirstTime);
    console.log('チケットプラン表示完了');
  } catch (error) {
    console.error('初期化エラー:', error);
    // エラーが発生してもプランは表示する
    displayTicketPlans(true);
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
  
  // 戻るボタンを無効化
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.style.pointerEvents = 'none';
    backButton.style.opacity = '0.5';
  }
  
  try {
    // チケットが選択されているかチェック
    if (!selectedTicket) {
      showError('プランを選択してください');
      return;
    }
    
    // ユーザーIDを取得（会員情報から）
    let uid = getUserIdFromUserData();
    if (!uid) {
      // フォールバック: 生成されたUIDを使用
      uid = localStorage.getItem('currentUID');
      if (!uid) {
        uid = generateUID();
        localStorage.setItem('currentUID', uid);
      }
    }
    
    // チケット情報を保存
    const ticketData = {
      type: selectedTicket.id,
      name: selectedTicket.name,
      price: selectedTicket.price,
      minutes: selectedTicket.minutes,
      uid: uid,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('selectedTicket', JSON.stringify(ticketData));
    console.log('チケット情報を保存:', ticketData);
    
    // 決済処理を直接実行
    await processPaymentDirectly(uid, ticketData);
    
  } catch (error) {
    console.error('決済処理エラー:', error);
    hideLoading();
    showError('決済処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。');
    
    // ボタンを復元
    resetPaymentButton();
    
    // 戻るボタンを再有効化
    const backButton = document.getElementById('backButton');
    if (backButton) {
      backButton.style.pointerEvents = 'auto';
      backButton.style.opacity = '1';
    }
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
    console.log('遷移URL:', fallbackUrl);
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

// 会員情報を表示
async function displayMemberInfo() {
  try {
    console.log('=== 会員情報表示開始 ===');
    
    // まずはlocalStorageから直接取得を試行
    const userDataString = localStorage.getItem('userData');
    if (userDataString) {
      const userData = JSON.parse(userDataString);
      console.log('localStorageから会員情報を取得:', userData);
      
      if (userData.nickname || userData.email) {
        displayMemberInfoFromData(userData);
        return;
      }
    }
    
    // URLパラメータから取得を試行
    const urlParams = new URLSearchParams(window.location.search);
    const nickname = urlParams.get('nickname');
    const birthYear = urlParams.get('birthYear');
    const birthMonth = urlParams.get('birthMonth');
    const birthDay = urlParams.get('birthDay');
    const email = urlParams.get('email');
    
    if (nickname && birthYear && birthMonth && birthDay) {
      const userData = {
        nickname: nickname,
        birthYear: birthYear,
        birthMonth: birthMonth,
        birthDay: birthDay,
        email: email || ''
      };
      console.log('URLパラメータから会員情報を取得:', userData);
      displayMemberInfoFromData(userData);
      return;
    }
    
    if (email) {
      const userData = { email: email };
      console.log('メールアドレスから会員情報を取得:', userData);
      displayMemberInfoFromData(userData);
      return;
    }
    
    // デバッグ: テスト用の会員情報を表示
    console.log('認証情報が見つかりません。テスト用の会員情報を表示します。');
    console.log('localStorage keys:', Object.keys(localStorage));
    console.log('URL parameters:', window.location.search);
    
    const testUserData = {
      nickname: 'テストユーザー',
      birthYear: '1990',
      birthMonth: '1',
      birthDay: '1'
    };
    console.log('テスト用の会員情報を表示:', testUserData);
    displayMemberInfoFromData(testUserData);

  } catch (error) {
    console.error('会員情報表示エラー:', error);
    redirectToLogin();
  }
}

// 生年月日をフォーマット
function formatBirthdate(userData) {
  if (userData.birthYear && userData.birthMonth && userData.birthDay) {
    return `${userData.birthYear}年${userData.birthMonth}月${userData.birthDay}日`;
  } else if (userData.birthdate) {
    return userData.birthdate;
  }
  return null;
}

// 会員情報を表示する共通関数
function displayMemberInfoFromData(userData) {
  const memberInfoContent = document.getElementById('memberInfoContent');
  if (!memberInfoContent) {
    console.log('会員情報表示要素が見つかりません');
    return;
  }

  // 会員情報を表示（ニックネームと生年月日のみ）
  memberInfoContent.innerHTML = `
    <div class="member-info-item">
      <span class="member-info-label">ニックネーム:</span>
      <span class="member-info-value">${userData.nickname || '未設定'}</span>
    </div>
    <div class="member-info-item">
      <span class="member-info-label">生年月日:</span>
      <span class="member-info-value">${formatBirthdate(userData) || '未設定'}</span>
    </div>
    <div class="member-info-notice">
      ✨ この購入情報はあなたのアカウントに紐づけられます
    </div>
  `;

  // 会員情報コンテナを表示
  const memberInfoContainer = document.getElementById('memberInfoContainer');
  if (memberInfoContainer) {
    memberInfoContainer.style.display = 'block';
    console.log('会員情報を表示しました');
  }
}

// 認証情報を取得
function getAuthInfo() {
  try {
    // localStorageからユーザーデータを取得
    const userDataString = localStorage.getItem('userData');
    if (userDataString) {
      const userData = JSON.parse(userDataString);
      // メールアドレスまたはニックネームと生年月日があれば認証情報として使用
      if (userData.email || (userData.nickname && userData.birthYear && userData.birthMonth && userData.birthDay)) {
        return userData;
      }
    }
    
    // URLパラメータから認証情報を取得
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const nickname = urlParams.get('nickname');
    const birthYear = urlParams.get('birthYear');
    const birthMonth = urlParams.get('birthMonth');
    const birthDay = urlParams.get('birthDay');
    
    if (email || (nickname && birthYear && birthMonth && birthDay)) {
      return {
        email: email || '',
        nickname: nickname || '',
        birthYear: birthYear || '',
        birthMonth: birthMonth || '',
        birthDay: birthDay || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error('認証情報取得エラー:', error);
    return null;
  }
}

// Cloudflareデータベースからユーザーデータを取得
async function fetchUserDataFromDatabase(authInfo) {
  try {
    const url = new URL('/api/get-user-data', window.location.origin);
    
    // 認証情報をパラメータとして送信
    if (authInfo.email) {
      url.searchParams.set('email', authInfo.email);
    }
    if (authInfo.nickname && authInfo.birthYear && authInfo.birthMonth && authInfo.birthDay) {
      url.searchParams.set('nickname', authInfo.nickname);
      url.searchParams.set('birthYear', authInfo.birthYear);
      url.searchParams.set('birthMonth', authInfo.birthMonth);
      url.searchParams.set('birthDay', authInfo.birthDay);
    }
    
    console.log('ユーザーデータ取得API呼び出し:', url.toString());
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('ユーザーデータ取得結果:', result);
    
    if (result.success && result.userData) {
      // 取得したデータをlocalStorageに保存
      localStorage.setItem('userData', JSON.stringify(result.userData));
      return result.userData;
    } else {
      console.log('ユーザーデータの取得に失敗:', result.message);
      return null;
    }
    
  } catch (error) {
    console.error('データベースからユーザーデータ取得エラー:', error);
    return null;
  }
}

// ログイン画面にリダイレクト
function redirectToLogin() {
  console.log('ログイン画面にリダイレクトします');
  // ログイン画面にリダイレクト
  window.location.href = '../auth/login.html';
}

// 決済処理を直接実行
async function processPaymentDirectly(uid, ticketData) {
  try {
    console.log('決済処理を直接実行:', { uid, ticketData });
    
    // テスト決済の場合は直接confirm.htmlに遷移
    const checkoutId = `test-checkout-${Date.now()}`;
    console.log('テスト決済を実行:', checkoutId);
    
    // 決済確認APIを呼び出し
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uid: uid,
        checkoutId: checkoutId,
        ticketData: ticketData
      })
    });
    
    const result = await response.json();
    console.log('決済確認API結果:', result);
    
    if (result.ok) {
      // localStorageに有効期限を保存
      localStorage.setItem('expireAt', result.expireAt);
      console.log('決済確認完了');
      
      // confirm.htmlに遷移
      window.location.href = `./confirm.html?uid=${uid}&checkoutId=${checkoutId}`;
    } else {
      console.error('決済確認失敗:', result);
      showError('決済の確認に失敗しました。サポートにお問い合わせください。');
      hideLoading();
      resetPaymentButton();
    }
    
  } catch (error) {
    console.error('決済処理エラー:', error);
    showError('決済処理中にエラーが発生しました。サポートにお問い合わせください。');
    hideLoading();
    resetPaymentButton();
  }
}

// 会員情報を非表示
function hideMemberInfo() {
  const memberInfoContainer = document.getElementById('memberInfoContainer');
  if (memberInfoContainer) {
    memberInfoContainer.style.display = 'none';
  }
}

// 初回購入者かどうかをチェック
async function checkFirstTimeUser() {
  try {
    // ユーザーIDを取得
    let uid = getUserIdFromUserData();
    if (!uid) {
      // ユーザーIDが取得できない場合は初回購入者として扱う
      console.log('ユーザーIDが取得できないため、初回購入者として扱います');
      return true;
    }
    
    // データベースから購入履歴を取得
    console.log('購入履歴をチェック中...');
    const response = await fetch(`/api/purchase-history?userId=${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('購入履歴:', data);
      
      // 購入履歴がある場合は初回購入者ではない
      if (data.purchases && data.purchases.length > 0) {
        console.log('リピーター購入者です');
        return false;
      }
    }
    
    // 購入履歴がない場合は初回購入者
    console.log('初回購入者です');
    return true;
    
  } catch (error) {
    console.error('購入履歴チェックエラー:', error);
    // エラーが発生した場合は安全のため初回購入者として扱う
    return true;
  }
}

// チケットプランを表示
function displayTicketPlans(isFirstTime) {
  const container = document.getElementById('ticketsContainer');
  if (!container) {
    console.error('チケットコンテナが見つかりません');
    return;
  }
  
  container.innerHTML = '';
  
  TICKET_PLANS.forEach(plan => {
    // 初回購入者でない場合は、初回限定プランを非表示
    if (!isFirstTime && plan.firstTimeOnly) {
      return;
    }
    
    // チケットカードを作成
    const card = document.createElement('div');
    card.className = `ticket-card ${plan.firstTimeOnly ? 'first-time' : ''}`;
    card.dataset.planId = plan.id;
    
    // バッジ表示
    const badgeHtml = plan.badge ? `<span class="ticket-badge">${plan.badge}</span>` : '';
    
    // 料金表示（月額サブスクは特別な表示）
    const priceHtml = plan.id === 'monthly' 
      ? `<span class="price-amount">${plan.price}円/月</span>`
      : `<span class="price-amount ${plan.firstTimeOnly ? 'first-time' : ''}">${plan.price}円</span><span class="price-period">${plan.minutes}分</span>`;
    
    card.innerHTML = `
      <div class="ticket-header">
        <div class="ticket-emoji">${plan.emoji}</div>
        <div class="ticket-header-content">
          <h2 class="ticket-title">${plan.name}</h2>
          ${badgeHtml}
          <div class="ticket-price">
            ${priceHtml}
          </div>
        </div>
      </div>
      
      <div class="ticket-info">
        <div class="ticket-info-item">
          <span class="ticket-info-label">時間</span>
          <span class="ticket-info-value">${plan.minutes}分</span>
        </div>
        <div class="ticket-info-item">
          <span class="ticket-info-label">単価</span>
          <span class="ticket-info-value">${plan.pricePerMinute}円/分</span>
        </div>
      </div>
      
      <div class="ticket-description">
        <p class="main-description">${plan.description}</p>
      </div>
      
      <div class="ticket-action">
        <button class="purchase-button" data-plan-id="${plan.id}">
          <span class="purchase-icon">✨</span>
          <span class="purchase-text">このプランを購入する</span>
        </button>
      </div>
    `;
    
    // 購入ボタンのクリックイベント
    const purchaseButton = card.querySelector('.purchase-button');
    purchaseButton.addEventListener('click', (e) => {
      e.stopPropagation(); // カードのクリックイベントを阻止
      // 選択されたプランの情報をlocalStorageに保存
      localStorage.setItem('selectedTicket', JSON.stringify({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        minutes: plan.minutes,
        emoji: plan.emoji
      }));
      // 決済ページに遷移
      window.location.href = 'payment.html';
    });
    
    container.appendChild(card);
  });
  
  console.log('チケットプランを表示しました。初回購入者:', isFirstTime);
}

// チケットを選択
function selectTicket(plan, cardElement) {
  // すべてのカードから選択状態を解除
  document.querySelectorAll('.ticket-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // 選択したカードをハイライト
  cardElement.classList.add('selected');
  
  // 選択されたチケットを保存
  selectedTicket = plan;
  
  // 決済フォームを表示
  const paymentForm = document.getElementById('paymentFormContainer');
  if (paymentForm) {
    paymentForm.style.display = 'block';
    
    // ボタンテキストを更新
    const buttonText = document.getElementById('buttonText');
    const buttonSubtext = document.getElementById('buttonSubtext');
    
    if (buttonText && buttonSubtext) {
      buttonText.textContent = `${plan.price}円で${plan.name}を購入`;
      buttonSubtext.textContent = `${plan.minutes}分間の神秘的な鑑定`;
    }
    
    // スクロールしてフォームを表示
    paymentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  console.log('チケットを選択:', plan);
}

// ユーザーデータからユーザーIDを取得
function getUserIdFromUserData() {
  try {
    // 認証情報を取得
    const authInfo = getAuthInfo();
    if (!authInfo) {
      return null;
    }

    // メールアドレスを優先的にユーザーIDとして使用
    if (authInfo.email) {
      console.log('ユーザーIDとして使用:', authInfo.email);
      return authInfo.email;
    }

    // メールアドレスがない場合は、ニックネームと生年月日の組み合わせを使用
    if (authInfo.nickname && authInfo.birthYear && authInfo.birthMonth && authInfo.birthDay) {
      const userId = `${authInfo.nickname}_${authInfo.birthYear}_${authInfo.birthMonth}_${authInfo.birthDay}`;
      console.log('ユーザーIDとして使用:', userId);
      return userId;
    }

    return null;
  } catch (error) {
    console.error('ユーザーID取得エラー:', error);
    return null;
  }
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