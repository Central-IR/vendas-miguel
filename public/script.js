const DEVELOPMENT_MODE = true;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = window.location.origin + '/api';

let vendas = [];
let currentMonth = new Date();
let isOnline = false;
let sessionToken = null;
let lastDataHash = '';

// Variáveis para paginação dos modais
let pagoPagina = 1;
let aReceberPagina = 1;
let relatorioAno = new Date().getFullYear();
let relatorioPagina = 1;

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
        sessionStorage.setItem('vendasMiguelSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('vendasMiguelSession');
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
            sessionStorage.removeItem('vendasMiguelSession');
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
    const statusElem = document.getElementById('connectionStatus');
    if (!statusElem) return;
    
    if (isOnline) {
        statusElem.classList.remove('offline');
        statusElem.classList.add('online');
    } else {
        statusElem.classList.remove('online');
        statusElem.classList.add('offline');
    }
}

function startPolling() {
    loadVendas();
    setInterval(() => {
        if (isOnline || DEVELOPMENT_MODE) {
            loadVendas();
        }
    }, 30000);
}

async function loadVendas() {
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

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        vendas = data;
        isOnline = true;
        updateConnectionStatus();
        
        const newHash = JSON.stringify(vendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }
        
        console.log(`[${new Date().toLocaleTimeString()}] ${vendas.length} vendas carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        isOnline = false;
        updateConnectionStatus();
    }
}

async function syncData() {
    if (!isOnline && !DEVELOPMENT_MODE) {
        showToast('Servidor offline. Não é possível sincronizar.', 'error');
        return;
    }

    try {
        showToast('Sincronizando dados...', 'info');
        
        const headers = { 'Accept': 'application/json' };
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/sync`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error('Erro ao sincronizar');
        }

        const result = await response.json();
        console.log('✅ Sincronização:', result);
        
        await loadVendas();
        showToast('Dados sincronizados com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar dados', 'error');
    }
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

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    updateMonthDisplay();
    updateDashboard();
    updateTable();
}

function updateDashboard() {
    const mesSelecionado = currentMonth.getMonth();
    const anoSelecionado = currentMonth.getFullYear();
    
    let totalPagoMes = 0;
    let totalFaturadoMes = 0;
    let totalAReceberGeral = 0;
    let quantidadeEntregueGeral = 0;
    
    vendas.forEach(venda => {
        const valor = parseFloat(venda.valor_nf || 0);
        const dataEmissao = new Date(venda.data_emissao);
        
        // FATURADO: apenas do mês SELECIONADO (pela data de emissão)
        if (dataEmissao.getMonth() === mesSelecionado && dataEmissao.getFullYear() === anoSelecionado) {
            totalFaturadoMes += valor;
        }
        
        // PAGO: apenas do mês SELECIONADO (pela data de PAGAMENTO)
        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
            const dataPagamento = new Date(venda.data_pagamento);
            if (dataPagamento.getMonth() === mesSelecionado && dataPagamento.getFullYear() === anoSelecionado) {
                totalPagoMes += valor;
            }
        }
        
        // A RECEBER e ENTREGUE: contabilização universal (todos os meses)
        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
            quantidadeEntregueGeral++;
        } else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
            totalAReceberGeral += valor;
            quantidadeEntregueGeral++;
        }
    });
    
    document.getElementById('totalPago').textContent = formatCurrency(totalPagoMes);
    document.getElementById('totalAReceber').textContent = formatCurrency(totalAReceberGeral);
    document.getElementById('totalEntregue').textContent = quantidadeEntregueGeral;
    document.getElementById('totalFaturado').textContent = formatCurrency(totalFaturadoMes);
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    if (!container) return;
    
    let filteredVendas = getVendasForCurrentMonth();
    
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus === 'PAGO') {
        filteredVendas = filteredVendas.filter(v => v.origem === 'CONTAS_RECEBER' && v.data_pagamento);
    } else if (filterStatus) {
        filteredVendas = filteredVendas.filter(v => {
            if (v.origem === 'CONTROLE_FRETE') {
                const statusNormalizado = (v.status_frete || '').toUpperCase().replace(/\s+/g, '_');
                return statusNormalizado === filterStatus;
            }
            return false;
        });
    }
    
    if (filteredVendas.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma venda encontrada</div>';
        return;
    }
    
    filteredVendas.sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));
    
    const table = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>NF</th>
                        <th>Emissão</th>
                        <th>Órgão</th>
                        <th>Valor NF</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredVendas.map(venda => {
                        let status = '';
                        let statusClass = '';
                        let rowClass = '';
                        
                        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
                            status = 'PAGO';
                            statusClass = 'pago';
                            rowClass = 'row-pago';
                        } else if (venda.origem === 'CONTROLE_FRETE') {
                            status = venda.status_frete || 'EM_TRANSITO';
                            
                            if (status === 'ENTREGUE') {
                                statusClass = 'entregue';
                                rowClass = 'row-entregue';
                            } else if (status === 'EM_TRANSITO' || status === 'EM TRÂNSITO') {
                                statusClass = 'transito';
                            } else if (status === 'AGUARDANDO_COLETA' || status === 'AGUARDANDO COLETA') {
                                statusClass = 'aguardando';
                            } else if (status === 'EXTRAVIADO') {
                                statusClass = 'extraviado';
                            } else if (status === 'DEVOLVIDO') {
                                statusClass = 'devolvido';
                            } else {
                                statusClass = 'transito';
                            }
                        }
                        
                        return `
                        <tr class="${rowClass}">
                            <td><strong>${venda.numero_nf || '-'}</strong></td>
                            <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                            <td>${venda.nome_orgao || '-'}</td>
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
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = table;
}

function getVendasForCurrentMonth() {
    return vendas.filter(venda => {
        const vendaDate = new Date(venda.data_emissao);
        return vendaDate.getMonth() === currentMonth.getMonth() &&
               vendaDate.getFullYear() === currentMonth.getFullYear();
    });
}

// ============================================
// MODAL DE PAGAMENTOS (Dashboard Pago)
// ============================================
function openPagoModal() {
    pagoPagina = 1;
    renderPagoModal();
    document.getElementById('pagoModal').classList.add('show');
}

function closePagoModal() {
    document.getElementById('pagoModal').classList.remove('show');
}

function renderPagoModal() {
    const mesSelecionado = currentMonth.getMonth();
    const anoSelecionado = currentMonth.getFullYear();
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    document.getElementById('pagoModalTitulo').textContent = 
        `Pagamentos de ${months[mesSelecionado]} ${anoSelecionado}`;
    
    // Filtrar pagamentos pela DATA DE PAGAMENTO do mês SELECIONADO
    // Ordenados por data de pagamento crescente
    const vendasPagas = vendas
        .filter(v => {
            if (v.origem !== 'CONTAS_RECEBER' || !v.data_pagamento) return false;
            const dataPagamento = new Date(v.data_pagamento);
            return dataPagamento.getMonth() === mesSelecionado && 
                   dataPagamento.getFullYear() === anoSelecionado;
        })
        .sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));
    
    const totalPago = vendasPagas.reduce((sum, v) => sum + (parseFloat(v.valor_nf) || 0), 0);
    
    const modalBody = document.getElementById('pagoModalBody');
    const pagination = document.getElementById('pagoPagination');
    
    if (vendasPagas.length === 0) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; font-weight: 600;">Nenhum pagamento registrado neste mês</p>
            </div>
        `;
        pagination.innerHTML = '';
        return;
    }
    
    // Paginação - 4 registros por página
    const itensPorPagina = 4;
    const totalPaginas = Math.ceil(vendasPagas.length / itensPorPagina);
    const inicio = (pagoPagina - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const paginaVendas = vendasPagas.slice(inicio, fim);
    
    modalBody.innerHTML = `
        <div style="max-height: 400px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--th-bg); color: var(--th-color);">
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Nº NF</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Órgão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Emissão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Pagamento</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid var(--th-border); font-weight: 600;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginaVendas.map((venda) => `
                        <tr style="background: var(--bg-card);">
                            <td style="padding: 12px; border: 1px solid var(--border-color);"><strong>${venda.numero_nf}</strong></td>
                            <td style="padding: 12px; border: 1px solid var(--border-color);">${venda.nome_orgao}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_pagamento)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); text-align: right;"><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3); text-align: right;">
            <span style="font-size: 1.1rem; font-weight: 700; color: #22C55E;">Total: ${formatCurrency(totalPago)}</span>
        </div>
    `;
    
    // Paginação
    if (totalPaginas > 1) {
        pagination.innerHTML = `
            <button onclick="changePagoPagina(-1)" ${pagoPagina === 1 ? 'disabled' : ''} 
                    style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; border-radius: 4px; color: var(--text-primary); font-weight: 600;">‹</button>
            <span style="padding: 0 1rem; font-weight: 600;">${pagoPagina}</span>
            <button onclick="changePagoPagina(1)" ${pagoPagina === totalPaginas ? 'disabled' : ''}
                    style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; border-radius: 4px; color: var(--text-primary); font-weight: 600;">›</button>
        `;
    } else {
        pagination.innerHTML = '';
    }
}

function changePagoPagina(direction) {
    pagoPagina += direction;
    renderPagoModal();
}

// ============================================
// MODAL DE A RECEBER (Dashboard A Receber)
// ============================================
function openAReceberModal() {
    aReceberPagina = 1;
    renderAReceberModal();
    document.getElementById('aReceberModal').classList.add('show');
}

function closeAReceberModal() {
    document.getElementById('aReceberModal').classList.remove('show');
}

function renderAReceberModal() {
    // Filtrar notas a receber ordenadas por data de emissão crescente
    const vendasAReceber = vendas
        .filter(v => v.origem === 'CONTROLE_FRETE' && v.status_frete === 'ENTREGUE')
        .sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));
    
    const totalAReceber = vendasAReceber.reduce((sum, v) => sum + (parseFloat(v.valor_nf) || 0), 0);
    
    const modalBody = document.getElementById('aReceberModalBody');
    const pagination = document.getElementById('aReceberPagination');
    
    if (vendasAReceber.length === 0) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; font-weight: 600;">Nenhuma nota a receber</p>
            </div>
        `;
        pagination.innerHTML = '';
        return;
    }
    
    // Paginação - 4 registros por página
    const itensPorPagina = 4;
    const totalPaginas = Math.ceil(vendasAReceber.length / itensPorPagina);
    const inicio = (aReceberPagina - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const paginaVendas = vendasAReceber.slice(inicio, fim);
    
    modalBody.innerHTML = `
        <div style="max-height: 400px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--th-bg); color: var(--th-color);">
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Nº NF</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Órgão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Emissão</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid var(--th-border); font-weight: 600;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginaVendas.map((venda) => `
                        <tr style="background: var(--bg-card);">
                            <td style="padding: 12px; border: 1px solid var(--border-color);"><strong>${venda.numero_nf}</strong></td>
                            <td style="padding: 12px; border: 1px solid var(--border-color);">${venda.nome_orgao}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); text-align: right;"><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3); text-align: right;">
            <span style="font-size: 1.1rem; font-weight: 700; color: #F59E0B;">Total: ${formatCurrency(totalAReceber)}</span>
        </div>
    `;
    
    // Paginação
    if (totalPaginas > 1) {
        pagination.innerHTML = `
            <button onclick="changeAReceberPagina(-1)" ${aReceberPagina === 1 ? 'disabled' : ''} 
                    style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; border-radius: 4px; color: var(--text-primary); font-weight: 600;">‹</button>
            <span style="padding: 0 1rem; font-weight: 600;">${aReceberPagina}</span>
            <button onclick="changeAReceberPagina(1)" ${aReceberPagina === totalPaginas ? 'disabled' : ''}
                    style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; border-radius: 4px; color: var(--text-primary); font-weight: 600;">›</button>
        `;
    } else {
        pagination.innerHTML = '';
    }
}

function changeAReceberPagina(direction) {
    aReceberPagina += direction;
    renderAReceberModal();
}

// ============================================
// MODAL DE RELATÓRIO ANUAL
// ============================================
function openRelatorioAnualModal() {
    relatorioAno = new Date().getFullYear();
    relatorioPagina = 1;
    renderRelatorioAnual();
    document.getElementById('relatorioAnualModal').classList.add('show');
}

function closeRelatorioAnualModal() {
    document.getElementById('relatorioAnualModal').classList.remove('show');
}

function changeRelatorioYear(direction) {
    relatorioAno += direction;
    relatorioPagina = 1;
    renderRelatorioAnual();
}

function changeRelatorioPagina(direction) {
    relatorioPagina += direction;
    renderRelatorioAnual();
}

function renderRelatorioAnual() {
    document.getElementById('relatorioAnualTitulo').textContent = `Relatório Anual ${relatorioAno}`;
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    // Calcular dados por mês
    const dadosPorMes = months.map((nome, index) => {
        let faturado = 0;
        let pago = 0;
        
        vendas.forEach(venda => {
            const dataEmissao = new Date(venda.data_emissao);
            const valor = parseFloat(venda.valor_nf || 0);
            
            // Faturado: conta pela data de emissão
            if (dataEmissao.getFullYear() === relatorioAno && dataEmissao.getMonth() === index) {
                faturado += valor;
            }
            
            // Pago: conta pela data de pagamento
            if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
                const dataPagamento = new Date(venda.data_pagamento);
                if (dataPagamento.getFullYear() === relatorioAno && dataPagamento.getMonth() === index) {
                    pago += valor;
                }
            }
        });
        
        return { nome, faturado, pago };
    });
    
    // Paginação - 3 meses por página
    const mesesPorPagina = 3;
    const totalPaginas = Math.ceil(dadosPorMes.length / mesesPorPagina);
    const inicio = (relatorioPagina - 1) * mesesPorPagina;
    const fim = inicio + mesesPorPagina;
    const mesesPagina = dadosPorMes.slice(inicio, fim);
    
    // Calcular totais gerais do ano inteiro
    const totalFaturado = dadosPorMes.reduce((sum, m) => sum + m.faturado, 0);
    const totalPago = dadosPorMes.reduce((sum, m) => sum + m.pago, 0);
    
    const modalBody = document.getElementById('relatorioAnualBody');
    
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            ${mesesPagina.map((mes, indexPagina) => {
                // Usar o índice real do mês no ano (0-11)
                const mesIndex = inicio + indexPagina;
                
                // Buscar o mês anterior no array completo dadosPorMes
                const mesAnterior = mesIndex > 0 ? dadosPorMes[mesIndex - 1] : null;
                
                // Calcular tendências
                let faturadoTendencia = '';
                let pagoTendencia = '';
                
                if (mesAnterior) {
                    // Tendência Faturado
                    if (mes.faturado > mesAnterior.faturado) {
                        faturadoTendencia = '<span style="color: #22C55E; font-size: 1.2rem; margin-left: 0.25rem;">▲</span>';
                    } else if (mes.faturado < mesAnterior.faturado) {
                        faturadoTendencia = '<span style="color: #EF4444; font-size: 1.2rem; margin-left: 0.25rem;">▼</span>';
                    }
                    
                    // Tendência Pago
                    if (mes.pago > mesAnterior.pago) {
                        pagoTendencia = '<span style="color: #22C55E; font-size: 1.2rem; margin-left: 0.25rem;">▲</span>';
                    } else if (mes.pago < mesAnterior.pago) {
                        pagoTendencia = '<span style="color: #EF4444; font-size: 1.2rem; margin-left: 0.25rem;">▼</span>';
                    }
                }
                
                return `
                <div style="padding: 1rem; background: var(--bg-card); border: 1px solid rgba(107, 114, 128, 0.2); border-radius: 8px;">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; color: var(--text-primary);">${mes.nome}</h4>
                    <div style="margin-bottom: 0.5rem;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Faturado</div>
                        <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center;">
                            ${formatCurrency(mes.faturado)}${faturadoTendencia}
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Pago</div>
                        <div style="font-size: 1rem; font-weight: 700; color: #22C55E; display: flex; align-items: center;">
                            ${formatCurrency(mes.pago)}${pagoTendencia}
                        </div>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
        
        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; border-top: 1px solid rgba(107, 114, 128, 0.2); border-bottom: 1px solid rgba(107, 114, 128, 0.2);">
            <button onclick="changeRelatorioPagina(-1)" ${relatorioPagina === 1 ? 'disabled' : ''} 
                    style="padding: 8px 16px; border: 1px solid rgba(107, 114, 128, 0.2); background: var(--bg-card); cursor: pointer; border-radius: 4px; font-weight: 600; color: var(--text-primary);">‹</button>
            <span style="font-weight: 600;">${relatorioPagina}</span>
            <button onclick="changeRelatorioPagina(1)" ${relatorioPagina === totalPaginas ? 'disabled' : ''}
                    style="padding: 8px 16px; border: 1px solid rgba(107, 114, 128, 0.2); background: var(--bg-card); cursor: pointer; border-radius: 4px; font-weight: 600; color: var(--text-primary);">›</button>
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: center; max-width: 800px; margin: 0 auto;">
            <div style="flex: 0 1 auto; min-width: 250px; text-align: center; padding: 1rem; background: var(--bg-card); border: 1px solid rgba(107, 114, 128, 0.2); border-radius: 8px;">
                <div style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Total Faturado</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${formatCurrency(totalFaturado)}</div>
            </div>
            <div style="flex: 0 1 auto; min-width: 250px; text-align: center; padding: 1rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
                <div style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Total Pago</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #22C55E;">${formatCurrency(totalPago)}</div>
            </div>
        </div>
    `;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
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
            <p><strong>Valor:</strong> ${formatCurrency(venda.valor_nf)}</p>
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
    if (!value) return 'R$ 0,00';
    const num = parseFloat(value);
    return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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

// ============================================
// CALENDAR FUNCTIONS
// ============================================
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

// Event listeners para fechar modais clicando fora
document.addEventListener('click', (e) => {
    const modals = ['calendarModal', 'pagoModal', 'aReceberModal', 'relatorioAnualModal', 'infoModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && e.target === modal) {
            modal.classList.remove('show');
            if (modalId === 'calendarModal') modal.style.display = 'none';
        }
    });
});
