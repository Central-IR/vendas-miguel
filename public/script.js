// CONFIGURAÇÃO
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:10000/api'
    : `${window.location.origin}/api`;

let vendas = [];
let isOnline = false;
let currentMonth = new Date();
let calendarYear = new Date().getFullYear();

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

console.log('🚀 Vendas Miguel iniciada');
console.log('📍 API URL:', API_URL);

document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
});

function inicializarApp() {
    updateDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
    renderCalendar();
}

// STATUS DO SERVIDOR
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        });

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ SERVIDOR ONLINE');
            await loadVendas();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        console.error('❌ Erro ao verificar servidor:', error.message);
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

// CARREGAR VENDAS
async function loadVendas() {
    if (!isOnline) return;

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_URL}/vendas?_t=${timestamp}`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            mode: 'cors'
        });

        if (!response.ok) return;

        const data = await response.json();
        vendas = data;
        
        await updateDashboard();
        filterVendas();
        console.log(`✅ ${vendas.length} vendas carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
    }
}

function startPolling() {
    loadVendas();
    setInterval(() => {
        if (isOnline) loadVendas();
    }, 30000); // 30 segundos
}

// DASHBOARD - VALORES UNIVERSAIS (todos os meses)
async function updateDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        });

        if (!response.ok) return;

        const stats = await response.json();

        document.getElementById('totalPago').textContent = 
            `R$ ${stats.pago.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('totalAReceber').textContent = 
            `R$ ${stats.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('totalEntregue').textContent = stats.entregue;
        
        document.getElementById('totalFaturado').textContent = 
            `R$ ${stats.faturado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } catch (error) {
        console.error('❌ Erro ao atualizar dashboard:', error);
    }
}

// NAVEGAÇÃO POR MESES
function updateDisplay() {
    const display = document.getElementById('currentMonth');
    if (display) {
        display.textContent = `${meses[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
    filterVendas();
}

window.changeMonth = function(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    updateDisplay();
};

// FILTRAR VENDAS
window.filterVendas = function() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    
    const filtrados = vendas.filter(v => {
        // Filtrar por mês atual
        const dataEmissao = new Date(v.data_emissao + 'T00:00:00');
        const matchMes = dataEmissao.getMonth() === currentMonth.getMonth() && 
                         dataEmissao.getFullYear() === currentMonth.getFullYear();
        
        if (!matchMes) return false;
        
        // Filtrar por busca
        const matchSearch = !searchTerm || 
            v.numero_nf?.toString().includes(searchTerm) ||
            v.nome_orgao?.toLowerCase().includes(searchTerm);
        
        // Filtrar por status
        let matchStatus = true;
        if (filterStatus === 'PAGO') {
            matchStatus = v.is_pago === true;
        } else if (filterStatus === 'ENTREGUE') {
            matchStatus = v.is_pago === false && v.status_frete === 'ENTREGUE';
        } else if (filterStatus === 'EM TRÂNSITO') {
            matchStatus = v.is_pago === false && v.status_frete === 'EM TRÂNSITO';
        } else if (filterStatus === 'SIMPLES REMESSA') {
            matchStatus = v.is_pago === false && v.status_frete === 'SIMPLES REMESSA';
        } else if (filterStatus === 'REMESSA DE AMOSTRA') {
            matchStatus = v.is_pago === false && v.status_frete === 'REMESSA DE AMOSTRA';
        }
        
        return matchSearch && matchStatus;
    });

    renderTable(filtrados);
};

// RENDERIZAR TABELA
function renderTable(vendasExibir) {
    const tbody = document.getElementById('vendasContainer');
    if (!tbody) return;

    if (vendasExibir.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    Nenhuma venda encontrada
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = vendasExibir.map(v => {
        // Classe para linhas pagas (verde)
        const rowClass = v.is_pago ? 'row-pago' : '';
        
        // Status - mostrar status correto baseado na origem
        let statusBadge = '';
        if (v.is_pago) {
            // Vem do Contas a Receber - PAGO
            statusBadge = '<span class="badge entregue">PAGO</span>';
        } else if (v.origem === 'CONTROLE_FRETE') {
            // Vem do Controle de Frete - mostrar status do frete
            if (v.status_frete === 'ENTREGUE') {
                statusBadge = '<span class="badge entregue">ENTREGUE</span>';
            } else if (v.status_frete === 'EM TRÂNSITO') {
                statusBadge = '<span class="badge transito">EM TRÂNSITO</span>';
            } else if (v.status_frete === 'SIMPLES REMESSA') {
                statusBadge = '<span class="badge info">SIMPLES REMESSA</span>';
            } else if (v.status_frete === 'REMESSA DE AMOSTRA') {
                statusBadge = '<span class="badge warning">REMESSA DE AMOSTRA</span>';
            } else {
                statusBadge = `<span class="badge">${v.status_frete || '-'}</span>`;
            }
        }

        return `
            <tr class="${rowClass}">
                <td><strong>${v.numero_nf || '-'}</strong></td>
                <td>${formatDate(v.data_emissao)}</td>
                <td>${v.nome_orgao || '-'}</td>
                <td><strong>R$ ${parseFloat(v.valor_nf || 0).toFixed(2)}</strong></td>
                <td>${v.tipo_nf || '-'}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell" style="text-align: center;">
                    <button onclick="viewVenda('${v.id}')" class="action-btn view">Ver</button>
                </td>
            </tr>
        `;
    }).join('');
}

// FORMATAR DATA
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

// VER DETALHES
window.viewVenda = function(id) {
    const venda = vendas.find(v => String(v.id) === String(id));
    if (!venda) {
        showToast('Venda não encontrada', 'error');
        return;
    }

    // Montar detalhes baseado na origem
    let detalhesHTML = '';
    
    if (venda.origem === 'CONTAS_RECEBER') {
        // Exibir informações do Contas a Receber
        detalhesHTML = `
            <div class="info-line">
                <span class="info-label">Origem:</span>
                <span class="info-value"><strong>Contas a Receber (PAGO)</strong></span>
            </div>
            <div class="info-line">
                <span class="info-label">Nº NF:</span>
                <span class="info-value"><strong>${venda.numero_nf}</strong></span>
            </div>
            <div class="info-line">
                <span class="info-label">Data Emissão:</span>
                <span class="info-value">${formatDate(venda.data_emissao)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Órgão:</span>
                <span class="info-value">${venda.nome_orgao || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Valor NF:</span>
                <span class="info-value"><strong>R$ ${parseFloat(venda.valor_nf || 0).toFixed(2)}</strong></span>
            </div>
            <div class="info-line">
                <span class="info-label">Tipo NF:</span>
                <span class="info-value">${venda.tipo_nf || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Banco:</span>
                <span class="info-value">${venda.banco || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Data Vencimento:</span>
                <span class="info-value">${formatDate(venda.data_vencimento)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Data Pagamento:</span>
                <span class="info-value" style="color: var(--success-color); font-weight: 700;">${formatDate(venda.data_pagamento)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Observações:</span>
                <span class="info-value">${venda.observacoes || '-'}</span>
            </div>
        `;
    } else {
        // Exibir informações do Controle de Frete
        detalhesHTML = `
            <div class="info-line">
                <span class="info-label">Origem:</span>
                <span class="info-value"><strong>Controle de Frete (ENTREGUE)</strong></span>
            </div>
            <div class="info-line">
                <span class="info-label">Nº NF:</span>
                <span class="info-value"><strong>${venda.numero_nf}</strong></span>
            </div>
            <div class="info-line">
                <span class="info-label">Data Emissão:</span>
                <span class="info-value">${formatDate(venda.data_emissao)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Documento:</span>
                <span class="info-value">${venda.documento || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Valor NF:</span>
                <span class="info-value"><strong>R$ ${parseFloat(venda.valor_nf || 0).toFixed(2)}</strong></span>
            </div>
            <div class="info-line">
                <span class="info-label">Tipo NF:</span>
                <span class="info-value">${venda.tipo_nf || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Órgão:</span>
                <span class="info-value">${venda.nome_orgao || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Contato:</span>
                <span class="info-value">${venda.contato_orgao || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Transportadora:</span>
                <span class="info-value">${venda.transportadora || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Valor Frete:</span>
                <span class="info-value">R$ ${parseFloat(venda.valor_frete || 0).toFixed(2)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Data Coleta:</span>
                <span class="info-value">${formatDate(venda.data_coleta)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Cidade Destino:</span>
                <span class="info-value">${venda.cidade_destino || '-'}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Previsão Entrega:</span>
                <span class="info-value">${formatDate(venda.previsao_entrega)}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Status:</span>
                <span class="info-value">${venda.status_frete || '-'}</span>
            </div>
        `;
    }

    const modal = document.getElementById('infoModal');
    document.getElementById('modalNumeroNF').textContent = venda.numero_nf;
    document.getElementById('modalBody').innerHTML = detalhesHTML;
    modal.style.display = 'flex';
};

window.closeInfoModal = function() {
    document.getElementById('infoModal').style.display = 'none';
};

// CALENDÁRIO
function renderCalendar() {
    const container = document.getElementById('calendarMonths');
    if (!container) return;

    document.getElementById('calendarYear').textContent = calendarYear;

    container.innerHTML = meses.map((mes, index) => {
        const isCurrentMonth = index === currentMonth.getMonth() && calendarYear === currentMonth.getFullYear();
        return `
            <button 
                class="calendar-month-btn ${isCurrentMonth ? 'active' : ''}" 
                onclick="selectMonth(${index})"
            >
                ${mes}
            </button>
        `;
    }).join('');
}

window.selectMonth = function(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    updateDisplay();
    toggleCalendar();
};

window.changeCalendarYear = function(direction) {
    calendarYear += direction;
    renderCalendar();
};

window.toggleCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.classList.toggle('show');
    }
};

// SINCRONIZAÇÃO MANUAL
window.syncData = async function() {
    if (!isOnline) {
        showToast('Sistema offline', 'error');
        return;
    }

    try {
        showToast('Sincronizando...', 'success');
        
        const response = await fetch(`${API_URL}/sync`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Erro ao sincronizar');
        }

        await loadVendas();
        showToast('Dados sincronizados com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar', 'error');
    }
};

// RELATÓRIO MENSAL (apenas notas pagas)
window.toggleRelatorioMes = function() {
    const modal = document.getElementById('relatorioModal');
    if (!modal) return;

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        return;
    }

    // Filtrar apenas notas PAGAS do mês atual pela DATA DE PAGAMENTO
    const vendasPagas = vendas.filter(v => {
        if (!v.is_pago || !v.data_pagamento) return false;

        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        return dataPagamento.getMonth() === currentMonth.getMonth() && 
               dataPagamento.getFullYear() === currentMonth.getFullYear();
    });

    // Ordenar por data de pagamento
    vendasPagas.sort((a, b) => {
        const dateA = new Date(a.data_pagamento);
        const dateB = new Date(b.data_pagamento);
        return dateA - dateB;
    });

    const titulo = document.getElementById('relatorioModalTitulo');
    const corpo = document.getElementById('relatorioModalBody');

    titulo.textContent = `Relatório Mensal - ${meses[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

    if (vendasPagas.length === 0) {
        corpo.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                Nenhum pagamento registrado neste mês
            </div>
        `;
    } else {
        corpo.innerHTML = `
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Nº NF</th>
                            <th>Data Emissão</th>
                            <th>Valor NF</th>
                            <th>Data Pagamento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vendasPagas.map(v => `
                            <tr class="row-pago">
                                <td><strong>${v.numero_nf}</strong></td>
                                <td>${formatDate(v.data_emissao)}</td>
                                <td><strong>R$ ${parseFloat(v.valor_nf || 0).toFixed(2)}</strong></td>
                                <td style="color: var(--success-color); font-weight: 700;">${formatDate(v.data_pagamento)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>Total do Mês</strong></td>
                            <td colspan="2"><strong>R$ ${vendasPagas.reduce((sum, v) => sum + parseFloat(v.valor_nf || 0), 0).toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }

    modal.style.display = 'flex';
};

window.closeRelatorioModal = function() {
    document.getElementById('relatorioModal').style.display = 'none';
};

// TOAST
function showToast(message, type) {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());

    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
