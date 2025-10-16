// サイドバーの表示/非表示
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('show');
    overlay.classList.toggle('hidden');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.remove('show');
    overlay.classList.add('hidden');
}

// メニュートグルボタン
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
});

// セクション表示切り替え
function showSection(sectionId) {
    // すべてのセクションを非表示
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // 指定されたセクションを表示
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // モバイルでサイドバーを閉じる
    closeSidebar();
    
    // アクティブなメニューアイテムを更新
    updateActiveMenuItem(sectionId);
}

function updateActiveMenuItem(activeId) {
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('bg-blue-100', 'text-blue-700');
        link.classList.add('text-gray-700');
    });
    
    const activeLink = document.querySelector(`[onclick="showSection('${activeId}')"]`);
    if (activeLink) {
        activeLink.classList.remove('text-gray-700');
        activeLink.classList.add('bg-blue-100', 'text-blue-700');
    }
}

// メッセージ表示関数
function showMessage(message, type = 'info') {
    const messageClass = {
        'success': 'bg-green-100 border-green-400 text-green-700',
        'error': 'bg-red-100 border-red-400 text-red-700',
        'warning': 'bg-yellow-100 border-yellow-400 text-yellow-700',
        'info': 'bg-blue-100 border-blue-400 text-blue-700'
    };

    return `
        <div class="border-l-4 ${messageClass[type]} p-4 rounded">
            <div class="flex">
                <div class="ml-3">
                    <p class="text-sm font-medium">${message}</p>
                </div>
            </div>
        </div>
    `;
}

// ローディング表示
function showLoading() {
    return `
        <div class="flex items-center justify-center py-4">
            <i class="fas fa-spinner fa-spin text-blue-600 mr-2"></i>
            <span class="text-gray-600">処理中...</span>
        </div>
    `;
}

// 会員検索
function setupMemberSearch() {
    const form = document.getElementById('memberSearchForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('searchEmail').value;
            const nickname = document.getElementById('searchNickname').value;
            const birthdate = document.getElementById('searchBirthdate').value;
            const resultsDiv = document.getElementById('searchResults');
            const contentDiv = document.getElementById('searchResultContent');
            
            // 少なくとも一つの検索条件が必要
            if (!email && !nickname && !birthdate) {
                contentDiv.innerHTML = showMessage('少なくとも一つの検索条件を入力してください', 'error');
                resultsDiv.classList.remove('hidden');
                return;
            }
            
            contentDiv.innerHTML = showLoading();
            resultsDiv.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/search-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        email: email,
                        nickname: nickname,
                        birthdate: birthdate
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    if (data.users && data.users.length > 0) {
                        contentDiv.innerHTML = `
                            <div class="mb-4">
                                <p class="text-sm text-gray-600">検索結果: ${data.users.length} 名の会員が見つかりました</p>
                            </div>
                            <div class="space-y-4">
                                ${data.users.map(user => `
                                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                                        <div class="flex justify-between items-start mb-4">
                                            <h4 class="font-semibold text-gray-900">会員情報 #${user.id}</h4>
                                            <div class="flex gap-2">
                                                <button onclick="viewChatHistory(${user.id}, '${user.email}')" 
                                                        class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors">
                                                    <i class="fas fa-comments mr-1"></i>会話履歴
                                                </button>
                                                <button onclick="withdrawUser(${user.id}, '${user.email}')" 
                                                        class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                                                    <i class="fas fa-user-times mr-1"></i>退会処理
                                                </button>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <p class="text-sm text-gray-600">メールアドレス</p>
                                                <p class="font-medium break-all">${user.email}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">ニックネーム</p>
                                                <p class="font-medium">${user.nickname || '未設定'}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">生年月日</p>
                                                <p class="font-medium">${user.birthdate || (user.birth_year && user.birth_month && user.birth_day ? 
                                                    `${user.birth_year}年${user.birth_month}月${user.birth_day}日` : '未設定')}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">合言葉</p>
                                                <p class="font-medium">${user.passphrase || '未設定'}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">登録日</p>
                                                <p class="font-medium">${new Date(user.created_at).toLocaleString('ja-JP')}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">最終アクセス</p>
                                                <p class="font-medium">${user.last_access ? new Date(user.last_access).toLocaleString('ja-JP') : '未記録'}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">守護神</p>
                                                <p class="font-medium">${user.guardian_name || '未設定'}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">悩みの種類</p>
                                                <p class="font-medium">${user.worry || '未設定'}</p>
                                            </div>
                                            <div>
                                                <p class="text-sm text-gray-600">会話履歴件数</p>
                                                <p class="font-medium">${user.chat_history ? user.chat_history.length : 0}件</p>
                                            </div>
                                        </div>
                                        ${user.chat_history && user.chat_history.length > 0 ? `
                                        <div class="mt-4 pt-4 border-t border-gray-200">
                                            <h5 class="text-sm font-medium text-gray-700 mb-3">最新の会話履歴 (最新${user.chat_history.length}件)</h5>
                                            <div class="space-y-2 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                                                ${user.chat_history.slice(0, 5).map(chat => `
                                                    <div class="flex items-start space-x-2 text-sm">
                                                        <span class="font-medium ${chat.sender === 'user' ? 'text-blue-600' : 'text-green-600'}">
                                                            ${chat.sender === 'user' ? '👤 ユーザー' : '🐉 龍'}:
                                                        </span>
                                                        <span class="text-gray-700 flex-1">${chat.content.length > 100 ? chat.content.substring(0, 100) + '...' : chat.content}</span>
                                                        <span class="text-xs text-gray-500">${new Date(chat.timestamp).toLocaleString('ja-JP')}</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    } else {
                        contentDiv.innerHTML = showMessage('該当する会員が見つかりませんでした', 'warning');
                    }
                } else {
                    contentDiv.innerHTML = showMessage(`エラー: ${data.error}`, 'error');
                }
            } catch (error) {
                contentDiv.innerHTML = showMessage(`通信エラー: ${error.message}`, 'error');
            }
        });
    }
}

// 検索フォームクリア
function clearSearchForm() {
    document.getElementById('searchEmail').value = '';
    document.getElementById('searchNickname').value = '';
    document.getElementById('searchBirthdate').value = '';
    document.getElementById('searchResults').classList.add('hidden');
}

// 会話履歴表示
async function viewChatHistory(userId, userEmail) {
    const contentDiv = document.getElementById('searchResultContent');
    if (!contentDiv) return;
    
    // 会話履歴表示中の表示
    contentDiv.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-center py-8">
                <i class="fas fa-spinner fa-spin text-blue-600 mr-2"></i>
                <span class="text-gray-600">会話履歴を読み込み中...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/get-chat-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: userId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.messages && data.messages.length > 0) {
                contentDiv.innerHTML = `
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-semibold text-gray-900">会話履歴 - ${userEmail}</h4>
                            <button onclick="refreshSearchResult('${userEmail}')" 
                                    class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                                <i class="fas fa-arrow-left mr-1"></i>検索結果に戻る
                            </button>
                        </div>
                        <div class="space-y-3 max-h-96 overflow-y-auto">
                            ${data.messages.map(message => `
                                <div class="border-l-4 ${message.sender === 'user' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'} p-3 rounded">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="text-xs font-medium ${message.sender === 'user' ? 'text-blue-700' : 'text-green-700'}">
                                                    ${message.sender === 'user' ? '👤 ユーザー' : '🐉 龍'}
                                                </span>
                                                <span class="text-xs text-gray-500">
                                                    ${new Date(message.timestamp).toLocaleString('ja-JP')}
                                                </span>
                                            </div>
                                            <p class="text-sm ${message.sender === 'user' ? 'text-blue-900' : 'text-green-900'}">
                                                ${message.content}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <p class="text-sm text-gray-600">
                                総メッセージ数: ${data.messages.length} 件
                            </p>
                        </div>
                    </div>
                `;
            } else {
                contentDiv.innerHTML = `
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-semibold text-gray-900">会話履歴 - ${userEmail}</h4>
                            <button onclick="refreshSearchResult('${userEmail}')" 
                                    class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                                <i class="fas fa-arrow-left mr-1"></i>検索結果に戻る
                            </button>
                        </div>
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-comments text-4xl mb-4"></i>
                            <p>会話履歴がありません</p>
                        </div>
                    </div>
                `;
            }
        } else {
            contentDiv.innerHTML = showMessage(`会話履歴の取得エラー: ${data.error}`, 'error');
        }
    } catch (error) {
        contentDiv.innerHTML = showMessage(`通信エラー: ${error.message}`, 'error');
    }
}

// ダッシュボード統計情報の読み込み
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/search-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (response.ok && data.users) {
            const totalMembersElement = document.getElementById('totalMembers');
            if (totalMembersElement) {
                totalMembersElement.textContent = data.users.length;
            }
            
            // 今日の登録数を計算
            const today = new Date().toDateString();
            const todayRegistrations = data.users.filter(user => 
                new Date(user.created_at).toDateString() === today
            ).length;
            
            const todayRegistrationsElement = document.getElementById('todayRegistrations');
            if (todayRegistrationsElement) {
                todayRegistrationsElement.textContent = todayRegistrations;
            }
        }
    } catch (error) {
        console.error('統計情報の読み込みエラー:', error);
    }
}


// マジックリンクテスト
function setupMagicLinkTest() {
    const form = document.getElementById('magicLinkTestForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('testEmail').value;
            const nickname = document.getElementById('testNickname').value;
            const resultDiv = document.getElementById('magicLinkResult');
            
            if (!resultDiv) return;
            
            resultDiv.innerHTML = showLoading();
            resultDiv.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/send-magic-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, nickname })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = showMessage(
                        `✅ マジックリンクを送信しました！<br>
                        メールアドレス: ${data.email}<br>
                        有効期限: ${new Date(data.expiresAt).toLocaleString('ja-JP')}<br>
                        <a href="${data.magicLink}" target="_blank" class="text-blue-600 underline mt-2 inline-block">マジックリンクを開く</a>`, 
                        'success'
                    );
                } else {
                    resultDiv.innerHTML = showMessage(`❌ エラー: ${data.error}`, 'error');
                }
            } catch (error) {
                resultDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
            }
        });
    }
}

// テストデータリセット
async function resetTestData() {
    const resultDiv = document.getElementById('dbResetResult');
    if (!resultDiv) return;
    
    resultDiv.innerHTML = showLoading();
    resultDiv.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/delete-all-test-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = showMessage('✅ テストデータを削除しました', 'success');
        } else {
            resultDiv.innerHTML = showMessage(`❌ エラー: ${data.error}`, 'error');
        }
    } catch (error) {
        resultDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
    }
}

// データベース状態確認（データベース整理セクション用）
async function checkDatabaseStatus() {
    const resultDiv = document.getElementById('dbCleanupResult');
    if (!resultDiv) return;
    
    resultDiv.innerHTML = showLoading();
    resultDiv.classList.remove('hidden');
    
    try {
        // 既存のdebug-db APIを使用してデータベース状態を確認
        const response = await fetch('/api/debug-db', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = showMessage(
                `✅ データベース接続正常<br>
                データベースバインド: ${data.database_bound ? 'OK' : 'NG'}<br>
                テーブル数: ${data.tables ? data.tables.length : 0}個<br>
                ユーザー数: ${data.user_count || 0}名<br>
                外部キー制約: ${data.foreign_keys_enabled ? '有効' : '無効'}<br>
                システム状態: 正常`, 
                'success'
            );
        } else {
            resultDiv.innerHTML = showMessage(`❌ データベースエラー: ${data.error}`, 'error');
        }
    } catch (error) {
        resultDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
    }
}

// データベース状態確認（DBリセットセクション用）
async function checkDatabaseStatusForReset() {
    const resultDiv = document.getElementById('dbResetResult');
    if (!resultDiv) return;
    
    resultDiv.innerHTML = showLoading();
    resultDiv.classList.remove('hidden');
    
    try {
        // 既存のdebug-db APIを使用してデータベース状態を確認
        const response = await fetch('/api/debug-db', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = showMessage(
                `✅ データベース接続正常<br>
                データベースバインド: ${data.database_bound ? 'OK' : 'NG'}<br>
                テーブル数: ${data.tables ? data.tables.length : 0}個<br>
                ユーザー数: ${data.user_count || 0}名<br>
                外部キー制約: ${data.foreign_keys_enabled ? '有効' : '無効'}<br>
                システム状態: 正常`, 
                'success'
            );
        } else {
            resultDiv.innerHTML = showMessage(`❌ データベースエラー: ${data.error}`, 'error');
        }
    } catch (error) {
        resultDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
    }
}

// 会員退会処理
async function withdrawUser(userId, userEmail) {
    // 確認ダイアログを表示
    const confirmed = confirm(
        `以下の会員を退会させますか？\n\n` +
        `ID: ${userId}\n` +
        `メールアドレス: ${userEmail}\n\n` +
        `この操作は取り消せません。`
    );
    
    if (!confirmed) {
        return;
    }
    
    const contentDiv = document.getElementById('searchResultContent');
    if (!contentDiv) return;
    
    // 退会処理中の表示
    contentDiv.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-center py-8">
                <i class="fas fa-spinner fa-spin text-blue-600 mr-2"></i>
                <span class="text-gray-600">退会処理中...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: userId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            contentDiv.innerHTML = showMessage(
                `✅ 退会処理が完了しました<br>
                ID: ${userId}<br>
                メールアドレス: ${userEmail}`, 
                'success'
            );
            
            // 検索フォームをクリア
            document.getElementById('searchEmail').value = '';
        } else {
            contentDiv.innerHTML = showMessage(`❌ 退会処理エラー: ${data.error}`, 'error');
        }
    } catch (error) {
        contentDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
    }
}


// 検索結果の情報更新
async function refreshSearchResult(email) {
    const contentDiv = document.getElementById('searchResultContent');
    if (!contentDiv) return;
    
    contentDiv.innerHTML = showLoading();
    
    try {
        const response = await fetch('/api/search-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email: email,
                searchType: 'email'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.users && data.users.length > 0) {
                const user = data.users[0];
                contentDiv.innerHTML = `
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-900 mb-2">会員情報</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-600">メールアドレス</p>
                                <p class="font-medium">${user.email}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">ニックネーム</p>
                                <p class="font-medium">${user.nickname || '未設定'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">登録日</p>
                                <p class="font-medium">${new Date(user.created_at).toLocaleString('ja-JP')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">ID</p>
                                <p class="font-medium">${user.id}</p>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-gray-200">
                            <div class="flex flex-col sm:flex-row gap-3">
                                <button onclick="withdrawUser(${user.id}, '${user.email}')" 
                                        class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center">
                                    <i class="fas fa-user-times mr-2"></i>
                                    退会処理
                                </button>
                                <button onclick="refreshSearchResult('${user.email}')" 
                                        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center">
                                    <i class="fas fa-refresh mr-2"></i>
                                    情報更新
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                contentDiv.innerHTML = showMessage('該当する会員が見つかりませんでした', 'warning');
            }
        } else {
            contentDiv.innerHTML = showMessage(`エラー: ${data.error}`, 'error');
        }
    } catch (error) {
        contentDiv.innerHTML = showMessage(`通信エラー: ${error.message}`, 'error');
    }
}

// 環境変数チェック
async function checkEnvironmentVariables() {
    const resultDiv = document.getElementById('envCheckResult');
    const apiStatusDiv = document.getElementById('apiStatus');
    const dbStatusDiv = document.getElementById('dbStatus');
    
    if (!resultDiv || !apiStatusDiv || !dbStatusDiv) return;
    
    resultDiv.classList.remove('hidden');
    apiStatusDiv.innerHTML = showLoading();
    dbStatusDiv.innerHTML = showLoading();
    
    try {
        // API設定チェック（マジックリンク送信テスト）
        const magicLinkResponse = await fetch('/api/send-magic-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: 'test@example.com', nickname: 'テスト' })
        });
        
        const magicLinkData = await magicLinkResponse.json();
        const apiStatus = magicLinkResponse.ok ? 'success' : 'error';
        const apiMessage = magicLinkResponse.ok ? 
            '✅ メール送信API設定正常' : 
            `❌ メール送信API設定エラー: ${magicLinkData.error}`;
        
        apiStatusDiv.innerHTML = showMessage(apiMessage, apiStatus);
        
        // データベース設定チェック
        const dbResponse = await fetch('/api/search-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        
        const dbData = await dbResponse.json();
        const dbStatus = dbResponse.ok ? 'success' : 'error';
        const dbMessage = dbResponse.ok ? 
            '✅ データベース接続正常' : 
            `❌ データベース接続エラー: ${dbData.error}`;
        
        dbStatusDiv.innerHTML = showMessage(dbMessage, dbStatus);
        
    } catch (error) {
        apiStatusDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
        dbStatusDiv.innerHTML = showMessage(`⚠️ 通信エラー: ${error.message}`, 'warning');
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // ダッシュボードを初期表示
    showSection('dashboard');
    updateActiveMenuItem('dashboard');
    
    // 統計情報を読み込み
    loadDashboardStats();
    
    // 各機能のセットアップ
    setupMemberSearch();
    setupMagicLinkTest();
    setupRegistrationTest();
    setupPurchaseHistory();
});

// 会員登録テスト機能のセットアップ
function setupRegistrationTest() {
    const registrationForm = document.getElementById('registrationTestForm');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(registrationForm);
            const registrationData = {
                email: formData.get('email'),
                nickname: formData.get('nickname'),
                birthdate: formData.get('birthdate'),
                guardian_id: formData.get('guardian_id'),
                theme: formData.get('theme')
            };
            
            const resultDiv = document.getElementById('registrationResult');
            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin text-blue-600"></i> 会員登録をテスト中...</div>';
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(registrationData)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    resultDiv.innerHTML = `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i class="fas fa-check-circle text-green-600 mr-3"></i>
                                <div>
                                    <h3 class="text-sm font-medium text-green-800">会員登録成功</h3>
                                    <div class="mt-2 text-sm text-green-700">
                                        <p><strong>ID:</strong> ${result.id}</p>
                                        <p><strong>メール:</strong> ${result.email}</p>
                                        <p><strong>ニックネーム:</strong> ${result.nickname}</p>
                                        <p><strong>登録日時:</strong> ${new Date(result.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i class="fas fa-exclamation-circle text-red-600 mr-3"></i>
                                <div>
                                    <h3 class="text-sm font-medium text-red-800">会員登録エラー</h3>
                                    <p class="mt-2 text-sm text-red-700">${result.error || '不明なエラーが発生しました'}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-circle text-red-600 mr-3"></i>
                            <div>
                                <h3 class="text-sm font-medium text-red-800">通信エラー</h3>
                                <p class="mt-2 text-sm text-red-700">${error.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
    }
}

// 購入履歴機能のセットアップ
function setupPurchaseHistory() {
    const historyForm = document.getElementById('purchaseHistoryForm');
    if (historyForm) {
        historyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(historyForm);
            const email = formData.get('email');
            
            const resultDiv = document.getElementById('purchaseHistoryResult');
            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin text-blue-600"></i> 購入履歴を取得中...</div>';
            
            try {
                const response = await fetch(`/api/purchase-history?email=${encodeURIComponent(email)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    const { user, purchases, statistics } = result;
                    
                    let purchasesHtml = '';
                    if (purchases.length > 0) {
                        purchasesHtml = purchases.map(purchase => `
                            <tr class="border-b border-gray-200">
                                <td class="px-4 py-3 text-sm text-gray-900">${purchase.ticket_name}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">${purchase.ticket_type}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">¥${purchase.price.toLocaleString()}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">${purchase.minutes}分</td>
                                <td class="px-4 py-3 text-sm text-gray-900">${purchase.payment_method}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">${new Date(purchase.purchase_date).toLocaleString()}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">${purchase.square_order_id || '-'}</td>
                            </tr>
                        `).join('');
                    } else {
                        purchasesHtml = `
                            <tr>
                                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                                    購入履歴がありません
                                </td>
                            </tr>
                        `;
                    }
                    
                    resultDiv.innerHTML = `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div class="mb-4">
                                <h3 class="text-lg font-medium text-green-800 mb-2">購入履歴</h3>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div class="bg-white p-3 rounded-lg">
                                        <div class="text-sm text-gray-600">ユーザー</div>
                                        <div class="font-semibold text-gray-900">${user.nickname} (${user.email})</div>
                                    </div>
                                    <div class="bg-white p-3 rounded-lg">
                                        <div class="text-sm text-gray-600">総購入回数</div>
                                        <div class="font-semibold text-gray-900">${statistics.totalPurchases}回</div>
                                    </div>
                                    <div class="bg-white p-3 rounded-lg">
                                        <div class="text-sm text-gray-600">総購入金額</div>
                                        <div class="font-semibold text-gray-900">¥${statistics.totalAmount.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="overflow-x-auto">
                                <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">チケット名</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">価格</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">決済方法</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">購入日時</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注文ID</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200">
                                        ${purchasesHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i class="fas fa-exclamation-circle text-red-600 mr-3"></i>
                                <div>
                                    <h3 class="text-sm font-medium text-red-800">エラー</h3>
                                    <p class="mt-2 text-sm text-red-700">${result.error || '不明なエラーが発生しました'}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-circle text-red-600 mr-3"></i>
                            <div>
                                <h3 class="text-sm font-medium text-red-800">通信エラー</h3>
                                <p class="mt-2 text-sm text-red-700">${error.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
    }
}
