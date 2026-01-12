const API_URL = window.location.origin + '/api';
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const DEVELOPMENT_MODE = true;

let isOnline = false;
let lastDataHash = '';
let currentMonth = new Date();
let allVendas = [];
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
    setInterval(checkServerStatus, 15000);
    setInterval(loadVendas, 30000);
}

function updateMonthDisplay() {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthStr = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    const elem = document.getElementById('currentMonth');
    if (elem) elem.textContent = monthStr;
}

function changeMonth(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    updateMonthDisplay();
    updateDisplay();
}

function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
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
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
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

function toggleChartModal() {
    const modal = document.getElementById('chartModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calculateAnnualStats();
        modal.classList.add('show');
    }
}

function calculateAnnualStats() {
    const year = currentMonth.getFullYear();
    const yearElem = document.getElementById('chartYear');
    if (yearElem) yearElem.textContent = year;
    
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
    
    const faturadoElem = document.getElementById('chartFaturado');
    const pagoElem = document.getElementById('chartPago');
    const pendenteElem = document.getElementById('chartPendente');
    
    if (faturadoElem) faturadoElem.textContent = formatCurrency(faturado);
    if (pagoElem) pagoElem.textContent = formatCurrency(pago);
    if (pendenteElem) pendenteElem.textContent = formatCurrency(pendente);
}

document.addEventListener('click', (e) => {
    const calendarModal = document.getElementById('calendarModal');
    const chartModal = document.getElementById('chartModal');
    
    if (calendarModal && e.target === calendarModal) {
        calendarModal.classList.remove('show');
    }
    if (chartModal && e.target === chartModal) {
        chartModal.classList.remove('show');
    }
});

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
        allVendas = data;
        
        const newHash = JSON.stringify(allVendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }

        await loadDashboard();
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
    }
}

async function loadDashboard() {
    try {
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

        monthVendas.forEach(venda => {
            const valor = parseFloat(venda.valor_nf) || 0;
            stats.faturado += valor;

            if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
                stats.pago += valor;
            } else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
                stats.aReceber += valor;
                stats.entregue += 1;
            }
        });
        
        const pagoElem = document.getElementById('totalPago');
        const receberElem = document.getElementById('totalAReceber');
        const entregueElem = document.getElementById('totalEntregue');
        const faturadoElem = document.getElementById('totalFaturado');
        
        if (pagoElem) pagoElem.textContent = formatCurrency(stats.pago);
        if (receberElem) receberElem.textContent = formatCurrency(stats.aReceber);
        if (entregueElem) entregueElem.textContent = stats.entregue;
        if (faturadoElem) faturadoElem.textContent = formatCurrency(stats.faturado);
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard:', error);
    }
}

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    updateTable();
    loadDashboard();
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    if (!container) return;
    
    const monthVendas = allVendas.filter(v => {
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth.getMonth() && 
               dataEmissao.getFullYear() === currentMonth.getFullYear();
    });
    
    let filteredVendas = [...monthVendas];
    
    const searchElem = document.getElementById('search');
    const filterStatusElem = document.getElementById('filterStatus');
    
    const search = searchElem ? searchElem.value.toLowerCase() : '';
    const filterStatus = filterStatusElem ? filterStatusElem.value : '';
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus) {
        filteredVendas = filteredVendas.filter(v => {
            if (filterStatus === 'PAGO') return v.origem === 'CONTAS_RECEBER' && v.data_pagamento;
            if (v.origem === 'CONTROLE_FRETE') return v.status_frete === filterStatus;
            return false;
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
        let statusClass = '';
        
        if (status === 'PAGO') {
            statusClass = 'pago';
        } else if (status === 'ENTREGUE') {
            statusClass = 'entregue';
        } else if (status === 'EM_TRANSITO') {
            statusClass = 'transito';
        } else if (status === 'AGUARDANDO_COLETA') {
            statusClass = 'aguardando';
        } else if (status === 'EXTRAVIADO') {
            statusClass = 'extraviado';
        } else if (status === 'DEVOLVIDO') {
            statusClass = 'devolvido';
        }
        
        return `
            <tr class="${status === 'PAGO' ? 'row-pago' : ''}">
                <td><strong>${venda.numero_nf}</strong></td>
                <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                <td>${venda.nome_orgao}</td>
                <td><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                <td>${venda.tipo_nf || '-'}</td>
                <td>
                    <span class="badge ${statusClass}">${status.replace(/_/g, ' ')}</span>
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
    if (venda.origem === 'CONTROLE_FRETE') {
        // Retornar o status real do frete
        return venda.status_frete || 'EM_TRANSITO';
    }
    return 'EM_TRANSITO';
}

function viewVenda(id) {
    const venda = allVendas.find(v => v.id === id);
    if (!venda) return;
    
    const nfElem = document.getElementById('modalNumeroNF');
    if (nfElem) nfElem.textContent = venda.numero_nf;
    
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    
    if (venda.origem === 'CONTAS_RECEBER') {
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
    
    const modal = document.getElementById('infoModal');
    if (modal) modal.classList.add('show');
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) modal.classList.remove('show');
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
