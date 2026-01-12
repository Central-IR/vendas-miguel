const DEVELOPMENT_MODE = false;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://vendas-miguel.onrender.com/api';

let vendas = [];
let currentMonth = new Date();
let isOnline = false;
let sessionToken = null;
let lastDataHash = '';
let relatorioMode = false;

console.log('🚀 Vendas Miguel iniciada');
console.log('📍 API URL:', API_URL);

document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO ATIVADO');
        sessionToken = 'dev-mode';
        inicializarApp();
    } else {
        verificarAutenticacao();
    }
});

function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('vendasSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('vendasSession');
    }

    if (!sessionToken) {
        mostrarTelaAcessoNegado();
        return;
    }

    inicializarApp();
}

function mostrarTelaAcessoNegado(mensagem = 'NÃO AUTORIZADO') {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: var(--bg-primary); color: var(--text-primary); text-align: center; padding: 2rem;">
            <h1 style="font-size: 2.2rem; margin-bottom: 1rem;">${mensagem}</h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">Somente usuários autenticados podem acessar esta área.</p>
            <a href="${PORTAL_URL}" style="display: inline-block; background: var(--btn-register); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    updateDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
    initCalendar();
}

async function checkServerStatus() {
    try {
        const headers = { 'Accept': 'application/json' };
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

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
    const statusRelatorio = document.getElementById('connectionStatusRelatorio');
    const className = isOnline ? 'connection-status online' : 'connection-status offline';
    
    if (statusElement) statusElement.className = className;
    if (statusRelatorio) statusRelatorio.className = className;
}

function startPolling() {
    loadVendas();
    setInterval(() => {
        if (isOnline) loadVendas();
    }, 10000);
}

async function loadVendas() {
    if (!isOnline && !DEVELOPMENT_MODE) return;

    try {
        const headers = { 'Accept': 'application/json' };
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) {
            console.error('❌ Erro ao carregar vendas:', response.status);
            return;
        }

        const data = await response.json();
        vendas = data;
        
        const newHash = JSON.stringify(vendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
    }
}

async function syncData() {
    if (!isOnline && !DEVELOPMENT_MODE) {
        showToast('Servidor offline. Não é possível sincronizar.', 'error');
        return;
    }

    showToast('Sincronizando dados...', 'info');
    await loadVendas();
    showToast('Dados sincronizados com sucesso!', 'success');
}

function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    updateDisplay();
}

function updateMonthDisplay() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    document.getElementById('currentMonth').textContent = `${monthName} ${year}`;
}

function toggleRelatorioMes() {
    // Abrir modal com relatório do mês
    const modal = document.getElementById('relatorioModal');
    if (!modal) return;
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    
    document.getElementById('relatorioModalTitulo').textContent = `Relatório - ${monthName} ${year}`;
    
    // Filtrar apenas vendas PAGAS do mês atual
    let vendasPagas = vendas.filter(v => {
        if (!v.data_pagamento || v.status_pagamento !== 'PAGO') return false;
        
        const dataPag = new Date(v.data_pagamento);
        return dataPag.getMonth() === currentMonth.getMonth() &&
               dataPag.getFullYear() === currentMonth.getFullYear();
    });
    
    const modalBody = document.getElementById('relatorioModalBody');
    
    if (vendasPagas.length === 0) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.3; margin-bottom: 1rem;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">Nenhum Pagamento Encontrado</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Não há pagamentos registrados para ${monthName} ${year}</p>
            </div>
        `;
    } else {
        // Ordenar por data de pagamento crescente
        vendasPagas.sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));
        
        const rows = vendasPagas.map(venda => `
            <tr>
                <td><strong>${venda.numero_nf || '-'}</strong></td>
                <td>${formatDate(venda.data_emissao)}</td>
                <td>${venda.nome_orgao || '-'}</td>
                <td>${formatDate(venda.data_pagamento)}</td>
            </tr>
        `).join('');
        
        modalBody.innerHTML = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-secondary); border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 12px; text-align: left; font-size: 0.85rem; text-transform: uppercase;">Nº NF</th>
                            <th style="padding: 12px; text-align: left; font-size: 0.85rem; text-transform: uppercase;">Data Emissão</th>
                            <th style="padding: 12px; text-align: left; font-size: 0.85rem; text-transform: uppercase;">Órgão</th>
                            <th style="padding: 12px; text-align: left; font-size: 0.85rem; text-transform: uppercase;">Data Pagamento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    modal.classList.add('show');
}

function closeRelatorioModal() {
    const modal = document.getElementById('relatorioModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

window.closeRelatorioModal = closeRelatorioModal;

function updateRelatorioMes() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    
    document.getElementById('relatorioMesNome').textContent = `${monthName} ${year}`;
    
    // Filtrar apenas vendas PAGAS do mês atual
    let vendasPagas = vendas.filter(v => {
        if (!v.data_pagamento || v.status_pagamento !== 'PAGO') return false;
        
        const dataPag = new Date(v.data_pagamento);
        return dataPag.getMonth() === currentMonth.getMonth() &&
               dataPag.getFullYear() === currentMonth.getFullYear();
    });
    
    // Aplicar filtro de pesquisa
    const search = document.getElementById('searchRelatorio').value.toLowerCase();
    if (search) {
        vendasPagas = vendasPagas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    // Ordenar por data de pagamento (crescente)
    vendasPagas.sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));
    
    const container = document.getElementById('relatorioContainer');
    
    if (vendasPagas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    Nenhuma venda paga encontrada neste mês
                </td>
            </tr>
        `;
        document.getElementById('relatorioTotal').textContent = 'R$ 0,00';
        return;
    }
    
    let totalMes = 0;
    container.innerHTML = vendasPagas.map(venda => {
        const valor = parseFloat(venda.valor_nf || 0);
        totalMes += valor;
        
        return `
            <tr>
                <td>${venda.numero_nf || '-'}</td>
                <td>${formatDate(venda.data_emissao)}</td>
                <td>${venda.nome_orgao || '-'}</td>
                <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong></td>
                <td>${formatDate(venda.previsao_entrega)}</td>
                <td>${formatDate(venda.data_pagamento)}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('relatorioTotal').textContent = `R$ ${totalMes.toFixed(2).replace('.', ',')}`;
}

function filterRelatorio() {
    updateRelatorioMes();
}

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    if (relatorioMode) {
        updateRelatorioMes();
    } else {
        updateMonthDisplay();
        updateDashboard();
        updateTable();
    }
}

function updateDashboard() {
    // NOVOS DASHBOARDS: PAGO | A RECEBER | ENTREGUE | FATURADO
    let totalPago = 0;
    let totalAReceber = 0;
    let quantidadeEntregue = 0;
    let totalFaturado = 0;
    
    vendas.forEach(venda => {
        const valor = parseFloat(venda.valor_nf || 0);
        
        // FATURADO: Soma TUDO (pagos + não pagos)
        totalFaturado += valor;
        
        // PAGO: Apenas registros com origem CONTAS_RECEBER e is_pago = true
        if (venda.is_pago === true || (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento)) {
            totalPago += valor;
        }
        // A RECEBER: Apenas registros de CONTROLE_FRETE (entregues mas não pagos)
        else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
            totalAReceber += valor;
        }
        
        // ENTREGUE: Quantidade de NFs que vieram do Controle de Frete marcadas como entregue
        if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
            quantidadeEntregue++;
        }
        // OU notas pagas (que também são consideradas entregues)
        else if (venda.is_pago === true || venda.origem === 'CONTAS_RECEBER') {
            quantidadeEntregue++;
        }
    });
    
    document.getElementById('totalPago').textContent = formatCurrency(totalPago);
    document.getElementById('totalAReceber').textContent = formatCurrency(totalAReceber);
    document.getElementById('totalEntregue').textContent = quantidadeEntregue;
    document.getElementById('totalFaturado').textContent = formatCurrency(totalFaturado);
}
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    let filteredVendas = getVendasForCurrentMonth();
    
    const search = document.getElementById('search').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus === 'PAGO') {
        filteredVendas = filteredVendas.filter(v => v.is_pago === true || v.origem === 'CONTAS_RECEBER');
    } else if (filterStatus === 'ENTREGUE') {
        filteredVendas = filteredVendas.filter(v => v.origem === 'CONTROLE_FRETE' && v.status_frete === 'ENTREGUE');
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
    
    // ORDENAR CRESCENTE por data de emissão
    filteredVendas.sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));
    
    container.innerHTML = filteredVendas.map(venda => {
        let status = 'ENTREGUE';
        let statusClass = 'reprovada';
        let rowClass = '';
        
        // Verificar se é PAGO (destaque verde)
        if (venda.is_pago === true || venda.origem === 'CONTAS_RECEBER') {
            status = 'PAGO';
            statusClass = 'aprovada';
            rowClass = 'row-pago';  // Classe para destacar linha inteira em verde
        }
        
        return `
        <tr class="${rowClass}">
            <td><strong>${venda.numero_nf || '-'}</strong></td>
            <td>${formatDate(venda.data_emissao)}</td>
            <td>${venda.nome_orgao || '-'}</td>
            <td><strong>R$ ${parseFloat(venda.valor_nf || 0).toFixed(2).replace('.', ',')}</strong></td>
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

function getVendasForCurrentMonth() {
    return vendas.filter(venda => {
        const vendaDate = new Date(venda.data_emissao);
        return vendaDate.getMonth() === currentMonth.getMonth() &&
               vendaDate.getFullYear() === currentMonth.getFullYear();
    });
}

function viewVenda(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;
    
    document.getElementById('modalNumeroNF').textContent = venda.numero_nf || '-';
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="info-section">
            <h4>Informações Gerais</h4>
            <p><strong>Nº NF:</strong> ${venda.numero_nf || '-'}</p>
            <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
            <p><strong>Órgão:</strong> ${venda.nome_orgao || '-'}</p>
            <p><strong>Valor:</strong> R$ ${parseFloat(venda.valor_nf || 0).toFixed(2).replace('.', ',')}</p>
            <p><strong>Tipo:</strong> ${venda.tipo_nf || '-'}</p>
            ${venda.transportadora ? `<p><strong>Transportadora:</strong> ${venda.transportadora}</p>` : ''}
            ${venda.previsao_entrega ? `<p><strong>Previsão Entrega:</strong> ${formatDate(venda.previsao_entrega)}</p>` : ''}
            ${venda.data_pagamento ? `<p><strong>Data Pagamento:</strong> ${formatDate(venda.data_pagamento)}</p>` : ''}
            ${venda.observacoes ? `<p><strong>Observações:</strong> ${venda.observacoes}</p>` : ''}
        </div>
    `;
    
    document.getElementById('infoModal').classList.add('show');
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('show');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
}

function showToast(message, type = 'success') {
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

// CALENDAR FUNCTIONS
let calendarYear = new Date().getFullYear();

function initCalendar() {
    calendarYear = currentMonth.getFullYear();
    renderCalendar();
}

function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        document.getElementById('calendarYear').textContent = calendarYear;
        renderCalendar();
    }
}

function changeCalendarYear(direction) {
    calendarYear += direction;
    document.getElementById('calendarYear').textContent = calendarYear;
    renderCalendar();
}

function renderCalendar() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const container = document.getElementById('calendarMonths');
    container.innerHTML = months.map((month, index) => {
        const isCurrentMonth = index === currentMonth.getMonth() && 
                              calendarYear === currentMonth.getFullYear();
        return `
            <button class="month-btn ${isCurrentMonth ? 'active' : ''}" 
                    onclick="selectMonth(${index})">
                ${month}
            </button>
        `;
    }).join('');
}

function selectMonth(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    toggleCalendar();
    updateDisplay();
}
