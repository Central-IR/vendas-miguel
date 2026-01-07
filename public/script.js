const API_URL = window.location.origin + '/api';
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const DEVELOPMENT_MODE = true; // Modo desenvolvimento (igual Ordem de Compra)

let vendas = [];
let isOnline = false;
let lastDataHash = '';
let currentMonth = new Date();
let allVendas = []; // Guardar todas as vendas
let sessionToken = null;
let calendarYear = new Date().getFullYear();

console.log('🚀 Vendas Miguel iniciada');
console.log('📍 API URL:', API_URL);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        sessionToken = 'dev-mode';
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        sessionToken = urlParams.get('sessionToken') || sessionStorage.getItem('vendasMiguelSession');
        
        if (!sessionToken) {
            mostrarMensagemNaoAutorizado();
            return;
        }
        
        if (urlParams.get('sessionToken')) {
            sessionStorage.setItem('vendasMiguelSession', sessionToken);
        }
    }
    
    inicializarApp();
});

function mostrarMensagemNaoAutorizado() {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a1a; color: white; text-align: center; padding: 2rem;">
            <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #CC7000;">NÃO AUTORIZADO</h1>
            <p style="font-size: 1.2rem; color: #999; margin-bottom: 2rem;">Acesso restrito. Por favor, faça login no portal.</p>
            <a href="${PORTAL_URL}" style="background: #CC7000; color: white; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1.1rem;">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    checkServerStatus();
    loadVendas();
    updateMonthDisplay();
    setInterval(checkServerStatus, 15000); // Check a cada 15s (antes 30s)
    setInterval(loadVendas, 30000); // Reload a cada 30s (antes 60s)
}

function updateMonthDisplay() {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthStr = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    document.getElementById('currentMonth').textContent = monthStr;
}

function changeMonth(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    updateMonthDisplay();
    updateDisplay();
}

// Calendar functions
function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calendarYear = currentMonth.getFullYear();
        renderCalendar();
        modal.classList.add('show');
    }
}

function changeCalendarYear(direction) {
    calendarYear += direction;
    renderCalendar();
}

function renderCalendar() {
    const yearElement = document.getElementById('calendarYear');
    const monthsContainer = document.getElementById('calendarMonths');
    
    if (!yearElement || !monthsContainer) return;
    
    yearElement.textContent = calendarYear;
    
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 
        'Maio', 'Junho', 'Julho', 'Agosto', 
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    monthsContainer.innerHTML = '';
    
    monthNames.forEach((name, index) => {
        const monthButton = document.createElement('div');
        monthButton.className = 'calendar-month';
        monthButton.textContent = name;
        
        if (calendarYear === currentMonth.getFullYear() && index === currentMonth.getMonth()) {
            monthButton.classList.add('current');
        }
        
        monthButton.onclick = () => selectMonth(index);
        monthsContainer.appendChild(monthButton);
    });
}

function selectMonth(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    updateMonthDisplay();
    updateDisplay();
    toggleCalendar();
}

// Chart modal functions
function toggleChartModal() {
    const modal = document.getElementById('chartModal');
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calculateAnnualStats();
        modal.classList.add('show');
    }
}

function calculateAnnualStats() {
    const year = currentMonth.getFullYear();
    document.getElementById('chartYear').textContent = year;
    
    const yearVendas = allVendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getFullYear() === year;
    });
    
    let faturado = 0;
    let pago = 0;
    
    yearVendas.forEach(venda => {
        const valor = parseFloat(venda.valor_nf) || 0;
        faturado += valor;
        
        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
            pago += valor;
        }
    });
    
    const pendente = faturado - pago;
    
    document.getElementById('chartFaturado').textContent = formatCurrency(faturado);
    document.getElementById('chartPago').textContent = formatCurrency(pago);
    document.getElementById('chartPendente').textContent = formatCurrency(pendente);
}

// Close modals on outside click
document.addEventListener('click', (e) => {
    const calendarModal = document.getElementById('calendarModal');
    const chartModal = document.getElementById('chartModal');
    
    if (e.target === calendarModal) {
        calendarModal.classList.remove('show');
    }
    if (e.target === chartModal) {
        chartModal.classList.remove('show');
    }
});

function inicializarApp() {
    checkServerStatus();
    loadVendas();
    updateMonthDisplay();
    setInterval(checkServerStatus, 30000); // Check a cada 30s
    setInterval(loadVendas, 60000); // Reload a cada 60s
}

async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/../health`);
        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ SERVIDOR ONLINE');
            await loadVendas();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        console.error('❌ Erro ao verificar servidor:', error);
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'connection-status online' : 'connection-status offline';
    }
}

async function syncData() {
    if (!isOnline) {
        showToast('Sistema offline', 'error');
        return;
    }

    showToast('Sincronizando...', 'success');
    
    try {
        const response = await fetch(`${API_URL}/sync`);
        if (!response.ok) throw new Error('Erro na sincronização');
        
        await loadVendas();
        showToast('Dados sincronizados!', 'success');
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar', 'error');
    }
}

async function loadVendas() {
    if (!isOnline) return;

    try {
        const response = await fetch(`${API_URL}/vendas`);
        if (!response.ok) throw new Error('Erro ao carregar vendas');

        const data = await response.json();
        allVendas = data; // Guardar todas
        
        const newHash = JSON.stringify(allVendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }

        // Carregar dashboard
        await loadDashboard();
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
    }
}

async function loadDashboard() {
    try {
        // Filtrar vendas do mês atual
        const monthVendas = allVendas.filter(v => {
            const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
            return dataEmissao.getMonth() === currentMonth.getMonth() && 
                   dataEmissao.getFullYear() === currentMonth.getFullYear();
        });

        const stats = {
            pago: 0,
            aReceber: 0,
            entregue: 0,
            faturado: 0
        };

        if (monthVendas) {
            monthVendas.forEach(venda => {
                const valor = parseFloat(venda.valor_nf) || 0;
                
                // Faturado = tudo
                stats.faturado += valor;

                if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
                    // Pago
                    stats.pago += valor;
                } else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
                    // A receber (entregue mas não pago)
                    stats.aReceber += valor;
                    stats.entregue += 1;
                }
            });
        }
        
        document.getElementById('totalPago').textContent = formatCurrency(stats.pago);
        document.getElementById('totalAReceber').textContent = formatCurrency(stats.aReceber);
        document.getElementById('totalEntregue').textContent = stats.entregue;
        document.getElementById('totalFaturado').textContent = formatCurrency(stats.faturado);
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard:', error);
    }
}

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    updateTable();
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    
    // Filtrar por mês atual
    const monthVendas = allVendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth.getMonth() && 
               dataEmissao.getFullYear() === currentMonth.getFullYear();
    });
    
    let filteredVendas = [...monthVendas];
    
    const search = document.getElementById('search').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus) {
        filteredVendas = filteredVendas.filter(v => {
            if (filterStatus === 'PAGO') return v.origem === 'CONTAS_RECEBER' && v.data_pagamento;
            if (filterStatus === 'ENTREGUE') return v.origem === 'CONTROLE_FRETE' && v.status_frete === 'ENTREGUE';
            return true;
        });
    }
    
    if (filteredVendas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    Nenhuma venda encontrada
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = filteredVendas.map(venda => {
        const status = getStatus(venda);
        const statusClass = status === 'PAGO' ? 'pago' : 'entregue';
        
        return `
            <tr class="${status === 'PAGO' ? 'row-pago' : ''}">
                <td><strong>${venda.numero_nf}</strong></td>
                <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                <td>${venda.nome_orgao}</td>
                <td><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                <td>${venda.tipo_nf || '-'}</td>
                <td>
                    <span class="badge ${statusClass}">${status}</span>
                </td>
                <td class="actions-cell">
                    <div class="actions">
                        <button onclick="viewVenda('${venda.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatus(venda) {
    if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
        return 'PAGO';
    }
    if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
        return 'ENTREGUE';
    }
    return 'ENTREGUE'; // Default
}

function viewVenda(id) {
    const venda = allVendas.find(v => v.id === id);
    if (!venda) return;
    
    document.getElementById('modalNumeroNF').textContent = venda.numero_nf;
    
    const modalBody = document.getElementById('modalBody');
    
    if (venda.origem === 'CONTAS_RECEBER') {
        // Exibir dados de Contas a Receber
        modalBody.innerHTML = `
            <div class="info-section">
                <h4>Informações da Conta</h4>
                <p><strong>Número NF:</strong> ${venda.numero_nf}</p>
                <p><strong>Órgão:</strong> ${venda.nome_orgao}</p>
                <p><strong>Valor:</strong> ${formatCurrency(venda.valor_nf)}</p>
                <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
                <p><strong>Data Vencimento:</strong> ${formatDate(venda.data_vencimento)}</p>
                <p><strong>Data Pagamento:</strong> ${venda.data_pagamento ? formatDate(venda.data_pagamento) : '-'}</p>
                <p><strong>Banco:</strong> ${venda.banco || '-'}</p>
                <p><strong>Status:</strong> <span class="badge pago">${venda.status_pagamento}</span></p>
                ${venda.observacoes ? `<p><strong>Observações:</strong> ${venda.observacoes}</p>` : ''}
            </div>
        `;
    } else {
        // Exibir dados de Controle de Frete
        modalBody.innerHTML = `
            <div class="info-section">
                <h4>Informações do Frete</h4>
                <p><strong>Número NF:</strong> ${venda.numero_nf}</p>
                <p><strong>Órgão:</strong> ${venda.nome_orgao}</p>
                <p><strong>Valor NF:</strong> ${formatCurrency(venda.valor_nf)}</p>
                <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
                ${venda.documento ? `<p><strong>Documento:</strong> ${venda.documento}</p>` : ''}
                ${venda.contato_orgao ? `<p><strong>Contato:</strong> ${venda.contato_orgao}</p>` : ''}
                <p><strong>Transportadora:</strong> ${venda.transportadora || '-'}</p>
                <p><strong>Valor Frete:</strong> ${formatCurrency(venda.valor_frete)}</p>
                ${venda.data_coleta ? `<p><strong>Data Coleta:</strong> ${formatDate(venda.data_coleta)}</p>` : ''}
                ${venda.cidade_destino ? `<p><strong>Cidade Destino:</strong> ${venda.cidade_destino}</p>` : ''}
                ${venda.previsao_entrega ? `<p><strong>Previsão Entrega:</strong> ${formatDate(venda.previsao_entrega)}</p>` : ''}
                <p><strong>Status:</strong> <span class="badge entregue">${venda.status_frete}</span></p>
            </div>
        `;
    }
    
    document.getElementById('infoModal').classList.add('show');
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    if (!value) return 'R$ 0,00';
    const num = parseFloat(value);
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function showToast(message, type = 'success') {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOutBottom 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
