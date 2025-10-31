// 入金履歴機能のセットアップ
function setupPaymentHistory() {
    const form = document.getElementById('paymentHistoryForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const period = formData.get('period');
            const date = formData.get('date');
            const month = formData.get('month');
            
            if (period === 'daily' && !date) {
                alert('日単位検索の場合は検索日を選択してください');
                return;
            }
            
            if (period === 'monthly' && !month) {
                alert('月単位検索の場合は検索月を選択してください');
                return;
            }
            
            await searchPayments(period, date, month);
        });
    }
}

// 入金履歴検索
async function searchPayments(period, date, month) {
    const resultDiv = document.getElementById('paymentHistoryResult');
    const tableBody = document.getElementById('paymentTableBody');
    const statsDiv = document.getElementById('paymentStats');
    
    if (!resultDiv || !tableBody || !statsDiv) return;
    
    resultDiv.classList.remove('hidden');
    tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>検索中...</td></tr>';
    
    try {
        let url = '/api/payment-history';
        const params = new URLSearchParams();
        
        if (period === 'daily' && date) {
            params.append('date', date);
        } else if (period === 'monthly' && month) {
            params.append('month', month);
        }
        // テスト決済も含める（既定trueだが明示）
        params.append('includeTest', 'true');
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayPaymentResults(data);
        } else {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-600">エラー: ${data.error}</td></tr>`;
            statsDiv.innerHTML = '';
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-600">通信エラー: ${error.message}</td></tr>`;
        statsDiv.innerHTML = '';
    }
}

// 全入金履歴表示
async function loadAllPayments() {
    await searchPayments('all', null, null);
}

// 入金履歴結果表示
function displayPaymentResults(data) {
    const tableBody = document.getElementById('paymentTableBody');
    const statsDiv = document.getElementById('paymentStats');
    
    if (!data.purchases || data.purchases.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">入金履歴がありません</td></tr>';
        statsDiv.innerHTML = '検索結果: 0件';
        return;
    }
    
    // テーブル行を生成
    const rows = data.purchases.map(purchase => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${new Date(purchase.purchased_at).toLocaleString('ja-JP')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div>
                    <div class="font-medium">${purchase.user?.nickname || '未設定'}</div>
                    <div class="text-gray-500">${purchase.user?.email || '不明'}</div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${purchase.ticket_name || purchase.ticket_type || '不明'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="font-medium text-green-600">¥${(purchase.amount || purchase.price || 0).toLocaleString()}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${purchase.payment_method || '不明'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    purchase.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 
                    purchase.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                }">
                    ${purchase.payment_status === 'completed' ? '完了' : 
                      purchase.payment_status === 'pending' ? '処理中' : 
                      purchase.payment_status || '不明'}
                </span>
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = rows;
    
    // 統計情報を表示
    const totalAmount = data.purchases.reduce((sum, p) => sum + (p.amount || p.price || 0), 0);
    const completedCount = data.purchases.filter(p => p.payment_status === 'completed').length;
    
    statsDiv.innerHTML = `
        検索結果: ${data.purchases.length}件 | 
        完了: ${completedCount}件 | 
        総額: ¥${totalAmount.toLocaleString()}
    `;
}

// CSV出力
function exportPayments() {
    const tableBody = document.getElementById('paymentTableBody');
    if (!tableBody || tableBody.children.length === 0) {
        alert('出力するデータがありません');
        return;
    }
    
    // CSVヘッダー
    const headers = ['日時', 'ユーザー名', 'メールアドレス', '商品名', '金額', '決済方法', 'ステータス'];
    
    // テーブルデータを取得
    const rows = Array.from(tableBody.children).map(row => {
        const cells = Array.from(row.children);
        return [
            cells[0]?.textContent?.trim() || '',
            cells[1]?.querySelector('.font-medium')?.textContent?.trim() || '',
            cells[1]?.querySelector('.text-gray-500')?.textContent?.trim() || '',
            cells[2]?.textContent?.trim() || '',
            cells[3]?.textContent?.trim() || '',
            cells[4]?.textContent?.trim() || '',
            cells[5]?.textContent?.trim() || ''
        ];
    });
    
    // CSVデータを生成
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    // ファイルダウンロード
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
