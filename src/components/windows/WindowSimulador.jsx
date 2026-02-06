import React, { useState, useRef, useEffect, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';
import { queryService, bannersService } from '../../services/api';
import WindowPreco from './WindowPreco';
import WindowEstoque from './WindowEstoque';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../common/ToastContainer';

const WindowSimulador = ({ onClose, zIndex, onFocus, userData, embedded = false }) => {
  const { toasts, mostrarToast, removerToast } = useToast();
  const [matricula, setMatricula] = useState('');
  const [funcionario, setFuncionario] = useState(null);
  const [cpfCliente, setCpfCliente] = useState('');
  const [cliente, setCliente] = useState(null);
  const [codigoProduto, setCodigoProduto] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState('');
  const [modalPesquisa, setModalPesquisa] = useState(false);
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [produtosPesquisa, setProdutosPesquisa] = useState([]);
  const [carregandoPesquisa, setCarregandoPesquisa] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [produtosDropdown, setProdutosDropdown] = useState([]);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [dataReceita, setDataReceita] = useState('');
  const [crmMedico, setCrmMedico] = useState('');
  const [ufCrm, setUfCrm] = useState('PR');
  const [modalControlado, setModalControlado] = useState(false);
  const [produtoControlado, setProdutoControlado] = useState(null);
  const [loteControlado, setLoteControlado] = useState('');
  const [validadeControlado, setValidadeControlado] = useState('');
  const [gerandoDbf, setGerandoDbf] = useState(false);
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannersError, setBannersError] = useState('');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerKey, setBannerKey] = useState(0);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [showRetirada, setShowRetirada] = useState(false);
  const [retiradaLojas, setRetiradaLojas] = useState([]);
  const [retiradaLoading, setRetiradaLoading] = useState(false);
  const [retiradaErro, setRetiradaErro] = useState('');
  const [retiradaLoja, setRetiradaLoja] = useState('');
  const [retiradaQuantidade, setRetiradaQuantidade] = useState(1);
  const [retiradaProdutoTemp, setRetiradaProdutoTemp] = useState(null);
  const [showPreco, setShowPreco] = useState(false);
  const [precoCodigoInicial, setPrecoCodigoInicial] = useState('');
  const [precoAutoBuscar, setPrecoAutoBuscar] = useState(false);
  const [showEstoque, setShowEstoque] = useState(false);
  const [estoqueCodigoInicial, setEstoqueCodigoInicial] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const cancelConfirmBtnRef = useRef(null);

  const setErroToast = useCallback((msg) => {
    setErro(msg);
    if (msg) {
      mostrarToast('erro', msg);
    }
  }, [mostrarToast]);

  const formatCpf = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^sem$/i.test(raw)) return 'SEM';
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Refs para focar nos campos
  const cpfClienteRef = useRef(null);
  const dataReceitaRef = useRef(null);
  const crmMedicoRef = useRef(null);
  const codigoProdutoRef = useRef(null);
  const dropdownRef = useRef(null);
  const produtosTableRef = useRef(null);
  const matriculaRef = useRef(null);
  const dataReceitaModalRef = useRef(null);
  const crmModalRef = useRef(null);
  const ufModalRef = useRef(null);
  const loteModalRef = useRef(null);
  const validadeModalRef = useRef(null);

  // Posicionar dropdown
  const posicionarDropdown = () => {
    if (codigoProdutoRef.current) {
      const rect = codigoProdutoRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    const carregarBanners = async () => {
      setBannersLoading(true);
      setBannersError('');
      try {
        const now = new Date();
        const pad2 = (n) => String(n).padStart(2, '0');
        const dataIni = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dataFim = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(lastDay)}`;
        const res = await bannersService.listar({ dataIni, dataFim, page: 1, perPage: 50, filtro: '' });
        if (res?.status === false) {
          setBanners([]);
          setBannersError('');
          return;
        }
        const list = Array.isArray(res?.msg?.data) ? res.msg.data
          : Array.isArray(res?.data?.data) ? res.data.data
            : Array.isArray(res?.data) ? res.data
              : Array.isArray(res?.banners) ? res.banners
                : Array.isArray(res) ? res
                  : [];
        const nowTs = Date.now();
        const normalized = list.map((b, idx) => ({
          id: b.id || b.ID || idx,
          titulo: b.titulo || b.TITULO || b.nome || b.NOME || '',
          imagem: b.banner || b.imagem || b.IMAGEM || b.image || b.url || b.URL || '',
          link: b.link || b.LINK || '',
          dataIni: b.dataini || b.dataIni || b.DATAINI || null,
          dataFim: b.datafim || b.dataFim || b.DATAFIM || null
        })).filter((b) => {
          if (!b.imagem) return false;
          const ini = b.dataIni ? Date.parse(b.dataIni) : null;
          const fim = b.dataFim ? Date.parse(b.dataFim) : null;
          if (Number.isFinite(ini) && nowTs < ini) return false;
          if (Number.isFinite(fim) && nowTs > fim) return false;
          return true;
        });
        setBanners(normalized);
        setBannerIndex(0);
        setBannerKey((k) => k + 1);
      } catch (e) {
        console.warn('Erro ao carregar banners (ignorado):', e);
        setBanners([]);
        setBannersError('');
      } finally {
        setBannersLoading(false);
      }
    };
    carregarBanners();
  }, []);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const timer = setInterval(() => {
      setBannerIndex((idx) => (idx + 1) % banners.length);
      setBannerKey((k) => k + 1);
    }, 8000);
    return () => clearInterval(timer);
  }, [banners]);

  // Buscar funcionário
  const buscarFuncionario = async () => {
    if (!matricula) return;

    setErro('');

    try {
      if (String(matricula).trim() === '1') {
        setFuncionario({ CDFUN: 1, NOME: 'CONSULTA' });
        setTimeout(() => cpfClienteRef.current?.focus(), 100);
        return;
      }
      const query = `
        SELECT CDFUN, NOME
        FROM scefun
        WHERE CDFUN = ${matricula}
          AND FGSITUAC = 1
        LIMIT 1
      `;
      const resultado = await queryService.execute(query);

      if (resultado && resultado.length > 0) {
        setFuncionario(resultado[0]);
        // Focar no campo de CPF do cliente
        setTimeout(() => cpfClienteRef.current?.focus(), 100);
      } else {
        setErroToast('Funcionário não encontrado');
        setFuncionario(null);
      }
    } catch (error) {
      console.error('Erro ao buscar funcionário:', error);
      setErroToast('Erro ao buscar funcionário');
    }
  };

  // Buscar cliente por CPF
  const buscarCliente = async () => {
    if (!cpfCliente) return;

    setErro('');

    try {
      if (String(cpfCliente).trim().toUpperCase() === 'SEM') {
        setCliente({
          NOME: 'SEM CADASTRO',
          CPF: 'SEM',
          CPF_LIMPO: null,
          ENDE: '',
          NRENDE: '',
          COMPL: '',
          BAIR: '',
          CIDA: '',
          ESTA: '',
          FONE: '',
          CELULAR: '',
          IDENTIDADE: ''
        });
        setTimeout(() => dataReceitaRef.current?.focus(), 100);
        return;
      }
      const cpfLimpo = cpfCliente.replace(/\D/g, '').replace(/^0+/, '');
      const query = `
        SELECT
          CODIGO,
          NOME,
          CPF,
          CPF_LIMPO,
          ENDE,
          NRENDE,
          COMPL,
          BAIR,
          CIDA,
          ESTA,
          FONE,
          CELULAR,
          IDENTIDADE
        FROM televendas.pdvcliente
        WHERE CPF_LIMPO = ${cpfLimpo}
        LIMIT 1
      `;
      const resultado = await queryService.execute(query);

      if (resultado && resultado.length > 0) {
        setCliente(resultado[0]);
        // Focar no campo de data da receita
        setTimeout(() => dataReceitaRef.current?.focus(), 100);
      } else {
        setErroToast('Cliente não encontrado');
        setCliente(null);
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      setErroToast('Erro ao buscar cliente');
    }
  };

  // Pesquisar produtos no modal
  const pesquisarProdutos = async (termo) => {
    if (!termo || termo.length < 3) {
      setProdutosPesquisa([]);
      return;
    }

    setCarregandoPesquisa(true);
    try {
      const query = `
        SELECT
          p.CDPRODU,
          p.NOME,
          p.PSICOTROPICO,
          COALESCE(e.ESTOQ, 0) as ESTOQUE,
          COALESCE(e.PRECOPOR, e.PRECOMAX, 0) as PRECO,
          COALESCE(e.PRECOMAX, 0) as PRECO_SEM_DESCONTO
        FROM sceprodu p
        LEFT JOIN sceestoq e ON e.CDPRODU = p.CDPRODU AND e.CDFIL = ${userData?.loja_id || 22}
        WHERE p.NOME LIKE '%${termo}%'
        ORDER BY COALESCE(e.ESTOQ, 0) DESC, p.NOME
        LIMIT 50
      `;
      const produtos = await queryService.execute(query);
      setProdutosPesquisa(produtos || []);
    } catch (error) {
      console.error('Erro ao pesquisar produtos:', error);
      setProdutosPesquisa([]);
    } finally {
      setCarregandoPesquisa(false);
    }
  };

  // Pesquisar produtos no dropdown (campo principal)
  const pesquisarProdutosDropdown = async (termo) => {
    if (!termo || termo.length < 2) {
      setProdutosDropdown([]);
      setShowDropdown(false);
      return;
    }

    // Verificar se é número (código)
    const isNumero = /^\d+$/.test(termo);

    if (isNumero) {
      // Se for número, não mostrar dropdown
      setProdutosDropdown([]);
      setShowDropdown(false);
      return;
    }

    try {
      const query = `
        SELECT
          p.CDPRODU,
          p.NOME,
          p.PSICOTROPICO,
          COALESCE(e.ESTOQ, 0) as ESTOQUE,
          COALESCE(e.PRECOPOR, e.PRECOMAX, 0) as PRECO,
          COALESCE(e.PRECOMAX, 0) as PRECO_SEM_DESCONTO
        FROM sceprodu p
        LEFT JOIN sceestoq e ON e.CDPRODU = p.CDPRODU AND e.CDFIL = ${userData?.loja_id || 22}
        WHERE p.NOME LIKE '%${termo}%'
        ORDER BY COALESCE(e.ESTOQ, 0) DESC, p.NOME
        LIMIT 20
      `;
      const produtos = await queryService.execute(query);
      setProdutosDropdown(produtos || []);
      setShowDropdown((produtos || []).length > 0);
      setDropdownIndex(0);
      if ((produtos || []).length > 0) {
        posicionarDropdown();
      }
    } catch (error) {
      console.error('Erro ao pesquisar produtos:', error);
      setProdutosDropdown([]);
      setShowDropdown(false);
    }
  };

  // Adicionar produto à lista
  const adicionarProduto = async (produtoData, codigoOverride) => {
    setErro('');

    try {
      if (!funcionario) {
        if (String(matricula || '').trim() === '1') {
          setFuncionario({ CDFUN: 1, NOME: 'CONSULTA' });
        } else {
          setErroToast('Informe a matrícula e clique em Buscar');
          matriculaRef.current?.focus();
          return;
        }
      }
      let produto = produtoData;

      // Se foi digitado código ou nome, buscar informações
      const codigoParaBuscar = codigoOverride || codigoProduto;
      if (!produtoData && codigoParaBuscar) {
        // Tentar primeiro por código/barras
        let query = `
          SELECT
            p.CDPRODU,
            p.NOME,
            p.PSICOTROPICO,
            COALESCE(e.ESTOQ, 0) as ESTOQUE,
            COALESCE(e.PRECOPOR, e.PRECOMAX, 0) as PRECO,
            COALESCE(e.PRECOMAX, 0) as PRECO_SEM_DESCONTO
          FROM sceprodu p
          LEFT JOIN sceestoq e ON e.CDPRODU = p.CDPRODU AND e.CDFIL = ${userData?.loja_id || 22}
          WHERE p.CDPRODU = '${codigoParaBuscar}'
            OR p.BARRA = '${codigoParaBuscar}'
            OR p.BAR1 = '${codigoParaBuscar}'
            OR p.BAR2 = '${codigoParaBuscar}'
            OR p.BAR3 = '${codigoParaBuscar}'
            OR p.BAR4 = '${codigoParaBuscar}'
          LIMIT 1
        `;
        let resultado = await queryService.execute(query);

        // Se não encontrou por código, tentar por nome
        if (!resultado || resultado.length === 0) {
          query = `
            SELECT
              p.CDPRODU,
              p.NOME,
              p.PSICOTROPICO,
              COALESCE(e.ESTOQ, 0) as ESTOQUE,
              COALESCE(e.PRECOPOR, e.PRECOMAX, 0) as PRECO,
              COALESCE(e.PRECOMAX, 0) as PRECO_SEM_DESCONTO
            FROM sceprodu p
            LEFT JOIN sceestoq e ON e.CDPRODU = p.CDPRODU AND e.CDFIL = ${userData?.loja_id || 22}
            WHERE p.NOME LIKE '%${codigoParaBuscar}%'
            ORDER BY COALESCE(e.ESTOQ, 0) DESC
            LIMIT 1
          `;
          resultado = await queryService.execute(query);
        }

        if (!resultado || resultado.length === 0) {
          setErroToast('Produto não encontrado');
          return;
        }

        produto = resultado[0];
      }

      // Verificar se é produto controlado
      const isControlado = produto.PSICOTROPICO === 'S';

      // Se for controlado e ainda não tem os dados obrigatórios, abrir modal
      if (isControlado) {
        setProdutoControlado(produto);
        setLoteControlado('');
        setValidadeControlado('');
        setModalControlado(true);
        return;
      }

      // Buscar promoção de quantidade (KITQTD e PRECOKIT)
      const queryPromo = `
        SELECT KITQTD, PRECOKIT
        FROM sceestoq
        WHERE CDFIL = ${userData?.loja_id || 22}
          AND CDPRODU = '${produto.CDPRODU}'
          AND KITQTD > 0
          AND PRECOKIT > 0
        LIMIT 1
      `;
      const resultPromo = await queryService.execute(queryPromo);
      const promocao = (resultPromo && resultPromo.length > 0) ? resultPromo[0] : null;

      // Verificar se produto já existe na lista
      const indexExistente = produtos.findIndex(p => p.CDPRODU === produto.CDPRODU);

      if (indexExistente >= 0) {
        // Se já existe, aumentar quantidade
        setProdutos(prev => prev.map((p, i) => {
          if (i === indexExistente) {
            const novaQtd = p.quantidade + 1;

            // Verificar se tem promoção de quantidade
            let precoBase = parseFloat(p.PRECO || 0);
            if (precoBase === 0) {
              precoBase = parseFloat(p.PRECO_SEM_DESCONTO || 0);
            }

            let precoUnitario = precoBase;
            let promocaoAplicada = false;

            // Verificar se atingiu a quantidade mínima para promoção
            if (promocao && novaQtd >= parseFloat(promocao.KITQTD)) {
              precoUnitario = parseFloat(promocao.PRECOKIT);
              promocaoAplicada = true;
            }

            return {
              ...p,
              quantidade: novaQtd,
              precoUnitario: precoUnitario,
              total: novaQtd * precoUnitario,
              kitQtd: promocao ? parseFloat(promocao.KITQTD) : 0,
              precoKit: promocao ? parseFloat(promocao.PRECOKIT) : 0,
              promocaoAplicada: promocaoAplicada
            };
          }
          return p;
        }));
      } else {
        // Adicionar à lista com quantidade 1
        // Se PRECO for 0, usar PRECO_SEM_DESCONTO (PRECOMAX)
        let precoBase = parseFloat(produto.PRECO || 0);
        if (precoBase === 0) {
          precoBase = parseFloat(produto.PRECO_SEM_DESCONTO || 0);
        }

        let precoUnitario = precoBase;
        let promocaoAplicada = false;

        // Verificar se tem promoção e se quantidade 1 já atinge o mínimo
        if (promocao && 1 >= parseFloat(promocao.KITQTD)) {
          precoUnitario = parseFloat(promocao.PRECOKIT);
          promocaoAplicada = true;
        }

        setProdutos(prev => [...prev, {
          ...produto,
          quantidade: 1,
          precoUnitario: precoUnitario,
          total: precoUnitario,
          kitQtd: promocao ? parseFloat(promocao.KITQTD) : 0,
          precoKit: promocao ? parseFloat(promocao.PRECOKIT) : 0,
          promocaoAplicada: promocaoAplicada,
          PRECO_SEM_DESCONTO: parseFloat(produto.PRECO_SEM_DESCONTO || 0)
        }]);
      }

      setCodigoProduto('');
      setModalPesquisa(false);
      setTermoPesquisa('');
      setProdutosPesquisa([]);
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      setErroToast('Erro ao adicionar produto');
    }
  };

  // Confirmar produto controlado com dados adicionais
  const confirmarProdutoControlado = async () => {
    if (!produtoControlado) return;

    // Validar campos obrigatórios
    if (!dataReceita || !crmMedico || !ufCrm || !loteControlado || !validadeControlado) {
      setErroToast('Preencha todos os campos obrigatórios para produto controlado');
      return;
    }

    setModalControlado(false);

    try {
      // Buscar promoção de quantidade (KITQTD e PRECOKIT)
      const queryPromo = `
        SELECT KITQTD, PRECOKIT
        FROM sceestoq
        WHERE CDFIL = ${userData?.loja_id || 22}
          AND CDPRODU = '${produtoControlado.CDPRODU}'
          AND KITQTD > 0
          AND PRECOKIT > 0
        LIMIT 1
      `;
      const resultPromo = await queryService.execute(queryPromo);
      const promocao = (resultPromo && resultPromo.length > 0) ? resultPromo[0] : null;

      // Verificar se produto já existe na lista
      const indexExistente = produtos.findIndex(p => p.CDPRODU === produtoControlado.CDPRODU);

      if (indexExistente >= 0) {
        // Se já existe, aumentar quantidade
        setProdutos(prev => prev.map((p, i) => {
          if (i === indexExistente) {
            const novaQtd = p.quantidade + 1;

            // Verificar se tem promoção de quantidade
            let precoBase = parseFloat(p.PRECO || 0);
            if (precoBase === 0) {
              precoBase = parseFloat(p.PRECO_SEM_DESCONTO || 0);
            }

            let precoUnitario = precoBase;
            let promocaoAplicada = false;

            // Verificar se atingiu a quantidade mínima para promoção
            if (promocao && novaQtd >= parseFloat(promocao.KITQTD)) {
              precoUnitario = parseFloat(promocao.PRECOKIT);
              promocaoAplicada = true;
            }

            return {
              ...p,
              quantidade: novaQtd,
              precoUnitario: precoUnitario,
              total: novaQtd * precoUnitario,
              kitQtd: promocao ? parseFloat(promocao.KITQTD) : 0,
              precoKit: promocao ? parseFloat(promocao.PRECOKIT) : 0,
              promocaoAplicada: promocaoAplicada
            };
          }
          return p;
        }));
      } else {
        // Adicionar à lista com quantidade 1
        let precoBase = parseFloat(produtoControlado.PRECO || 0);
        if (precoBase === 0) {
          precoBase = parseFloat(produtoControlado.PRECO_SEM_DESCONTO || 0);
        }

        let precoUnitario = precoBase;
        let promocaoAplicada = false;

        // Verificar se tem promoção e se quantidade 1 já atinge o mínimo
        if (promocao && 1 >= parseFloat(promocao.KITQTD)) {
          precoUnitario = parseFloat(promocao.PRECOKIT);
          promocaoAplicada = true;
        }

        setProdutos(prev => [...prev, {
          ...produtoControlado,
          quantidade: 1,
          precoUnitario: precoUnitario,
          total: precoUnitario,
          kitQtd: promocao ? parseFloat(promocao.KITQTD) : 0,
          precoKit: promocao ? parseFloat(promocao.PRECOKIT) : 0,
          promocaoAplicada: promocaoAplicada,
          PRECO_SEM_DESCONTO: parseFloat(produtoControlado.PRECO_SEM_DESCONTO || 0),
          dadosControlado: {
            dataReceita,
            crmMedico,
            ufCrm,
            lote: loteControlado,
            validade: validadeControlado
          }
        }]);
      }

      setProdutoControlado(null);
      setLoteControlado('');
      setValidadeControlado('');
      setCodigoProduto('');
      setErro('');
    } catch (error) {
      console.error('Erro ao adicionar produto controlado:', error);
      setErroToast('Erro ao adicionar produto controlado');
    }
  };

  // Atualizar quantidade do produto
  const atualizarQuantidade = (index, novaQuantidade) => {
    setProdutos(prev => prev.map((p, i) => {
      if (i === index) {
        const qtd = parseInt(novaQuantidade) || 0;

        // Preço base (se PRECO for 0, usar PRECO_SEM_DESCONTO)
        let precoBase = parseFloat(p.PRECO || 0);
        if (precoBase === 0) {
          precoBase = parseFloat(p.PRECO_SEM_DESCONTO || 0);
        }

        let precoUnitario = precoBase;
        let promocaoAplicada = false;

        // Verificar se atingiu a quantidade mínima para promoção
        if (p.kitQtd > 0 && qtd >= p.kitQtd) {
          precoUnitario = p.precoKit;
          promocaoAplicada = true;
        }

        return {
          ...p,
          quantidade: qtd,
          precoUnitario: precoUnitario,
          total: qtd * precoUnitario,
          promocaoAplicada: promocaoAplicada
        };
      }
      return p;
    }));
  };

  // Remover produto
  const removerProduto = useCallback((index) => {
    setProdutos(prev => prev.filter((_, i) => i !== index));
    if (produtoSelecionado === index) {
      setProdutoSelecionado(null);
    }
  }, [produtoSelecionado]);

  const formatLojaNome = (nome) => {
    if (!nome) return '';
    const raw = String(nome).trim();
    return raw.replace(/^\s*\d+\s*[-–]\s*/i, '');
  };

  const abrirRetiradaModal = useCallback(async (produto, index) => {
    if (!produto) return;
    setProdutoSelecionado(index);
    setRetiradaProdutoTemp(null);
    setShowRetirada(true);
    setRetiradaErro('');
    setRetiradaLoading(true);
    setRetiradaLoja('');
    setRetiradaQuantidade(produto.quantidade || 1);

    try {
      const query = `
        SELECT
          e.CDFIL AS loja_id,
          f.ABREV AS loja_nome,
          e.ESTOQ AS estoque
        FROM estwin.sceestoq e
        LEFT JOIN estwin.scefilial f ON f.CDFIL = e.CDFIL
        WHERE e.CDPRODU = '${produto.CDPRODU}'
          AND e.ESTOQ > 0
        ORDER BY e.ESTOQ DESC
      `;
      const rows = await queryService.execute(query);
      const cleaned = (rows || []).map((r) => ({
        ...r,
        loja_nome: formatLojaNome(r.loja_nome),
      }));
      setRetiradaLojas(cleaned);
      if (cleaned && cleaned.length > 0) {
        setRetiradaLoja(String(cleaned[0].loja_id));
      }
    } catch (e) {
      console.error('Erro ao buscar lojas com estoque:', e);
      setRetiradaErro('Erro ao buscar lojas disponíveis');
      setRetiradaLojas([]);
    } finally {
      setRetiradaLoading(false);
    }
  }, [formatLojaNome]);

  const confirmarRetirada = () => {
    if (produtoSelecionado == null) return;
    if (!retiradaLoja) {
      setRetiradaErro('Selecione a loja de retirada');
      return;
    }
    const qtdMax = Math.max(1, Number(produtos[produtoSelecionado]?.quantidade || 1));
    const qtd = Math.min(qtdMax, Math.max(1, parseInt(retiradaQuantidade, 10) || 1));
    const lojaInfo = retiradaLojas.find((l) => String(l.loja_id) === String(retiradaLoja));
    setProdutos((prev) => prev.map((p, i) => {
      if (i !== produtoSelecionado) return p;
      return {
        ...p,
        retirada: {
          loja_id: lojaInfo?.loja_id || retiradaLoja,
          loja_nome: lojaInfo?.loja_nome || '',
          quantidade: qtd,
        }
      };
    }));
    setShowRetirada(false);
  };

  const resetPrevenda = () => {
    setMatricula('');
    setFuncionario(null);
    setCpfCliente('');
    setCliente(null);
    setCodigoProduto('');
    setProdutos([]);
    setErro('');
    setDataReceita('');
    setCrmMedico('');
    setUfCrm('PR');
    setProdutoSelecionado(null);
    setShowDropdown(false);
    setProdutosDropdown([]);
    setModalPesquisa(false);
    setTermoPesquisa('');
    setProdutosPesquisa([]);
    setModalControlado(false);
    setProdutoControlado(null);
    setLoteControlado('');
    setValidadeControlado('');
    setShowRetirada(false);
    setRetiradaLojas([]);
    setRetiradaLoading(false);
    setRetiradaErro('');
    setRetiradaLoja('');
    setRetiradaQuantidade(1);
    setRetiradaProdutoTemp(null);
    setShowTokenModal(false);
    setTokenValue('');
    setTokenLoading(false);
    setTimeout(() => matriculaRef.current?.focus(), 0);
  };

  const aplicarToken = useCallback(async () => {
    if (produtoSelecionado == null || !produtos[produtoSelecionado]) {
      setErroToast('Selecione um produto para aplicar token');
      return;
    }
    if (!cliente) {
      setErroToast('Informe o cliente antes de usar token');
      return;
    }
    const token = String(tokenValue || '').trim();
    if (!token) {
      setErroToast('Informe o token');
      return;
    }
    const produto = produtos[produtoSelecionado];
    setTokenLoading(true);
    try {
      const query = `
        SELECT TOKEN, STATUS, PRODUTO, PRECO
        FROM scetoken
        WHERE TOKEN = '${token}'
          AND STATUS = '2'
          AND PRODUTO = '${produto.CDPRODU}'
        LIMIT 1
      `;
      const resultado = await queryService.execute(query);
      if (!resultado || resultado.length === 0) {
        setErroToast('Token inválido ou não aplicável para este produto');
        return;
      }
      const row = resultado[0];
      const precoToken = parseFloat(row.PRECO || 0);
      if (!precoToken || Number.isNaN(precoToken)) {
        setErroToast('Preço do token inválido');
        return;
      }
      setProdutos((prev) => prev.map((p, i) => {
        if (i !== produtoSelecionado) return p;
        const qtd = Number(p.quantidade || 0);
        return {
          ...p,
          precoUnitario: precoToken,
          total: qtd * precoToken,
          promocaoAplicada: false,
          tokenAplicado: true
        };
      }));
      setShowTokenModal(false);
      setTokenValue('');
    } catch (e) {
      console.error('Erro ao aplicar token:', e);
      setErroToast('Erro ao aplicar token');
    } finally {
      setTokenLoading(false);
    }
  }, [produtoSelecionado, produtos, cliente, tokenValue, setErroToast]);

  function gerarDbfLocal({ funcionario, cliente, produtos, dataReceita, crmMedico, ufCrm }) {
    const fieldDefs = [
      { name: 'TIPO', type: 'C', length: 1, decimals: 0 },
      { name: 'VEND', type: 'N', length: 6, decimals: 0 },
      { name: 'CODIGO', type: 'N', length: 13, decimals: 0 },
      { name: 'QUANT', type: 'N', length: 6, decimals: 0 },
      { name: 'PRECO', type: 'N', length: 12, decimals: 2 },
      { name: 'DESC', type: 'N', length: 10, decimals: 6 },
      { name: 'CRM', type: 'C', length: 50, decimals: 0 },
      { name: 'DATA', type: 'D', length: 8, decimals: 0 },
      { name: 'HORA', type: 'C', length: 8, decimals: 0 },
      { name: 'TRN', type: 'C', length: 1, decimals: 0 },
      { name: 'EPNSU', type: 'C', length: 40, decimals: 0 },
      { name: 'EPVLRAREC', type: 'N', length: 12, decimals: 2 },
      { name: 'FPLOGIN', type: 'C', length: 8, decimals: 0 },
      { name: 'FPVEND', type: 'N', length: 11, decimals: 0 },
      { name: 'FPSENHA', type: 'C', length: 8, decimals: 0 },
      { name: 'FPSENHAV', type: 'C', length: 8, decimals: 0 },
      { name: 'FPNSEQ', type: 'N', length: 6, decimals: 0 },
      { name: 'FPNNSU', type: 'C', length: 19, decimals: 0 },
      { name: 'FPVLRAR', type: 'N', length: 12, decimals: 2 },
      { name: 'FPQTDC', type: 'N', length: 6, decimals: 0 },
      { name: 'PHAAUTEN', type: 'C', length: 40, decimals: 0 },
      { name: 'PHAPROJETO', type: 'C', length: 40, decimals: 0 },
      { name: 'PHACARTAO', type: 'C', length: 40, decimals: 0 },
      { name: 'PHACPF', type: 'C', length: 20, decimals: 0 },
      { name: 'PHANSU', type: 'C', length: 40, decimals: 0 },
      { name: 'PHARECEBER', type: 'N', length: 12, decimals: 2 },
      { name: 'PHASUBS', type: 'N', length: 12, decimals: 2 },
      { name: 'PHMODALID', type: 'C', length: 20, decimals: 0 },
      { name: 'PHNRDEP', type: 'N', length: 12, decimals: 0 },
      { name: 'PHDDDCLI', type: 'N', length: 3, decimals: 0 },
      { name: 'PHTELCLI', type: 'N', length: 12, decimals: 0 },
      { name: 'PHRGCLI', type: 'N', length: 12, decimals: 0 },
      { name: 'FCNRCART', type: 'C', length: 40, decimals: 0 },
      { name: 'FCNSUADM', type: 'C', length: 40, decimals: 0 },
      { name: 'FCID', type: 'C', length: 8, decimals: 0 },
      { name: 'FCNRPRE', type: 'C', length: 40, decimals: 0 },
      { name: 'FCDTRECEI', type: 'C', length: 10, decimals: 0 },
      { name: 'FCCRM', type: 'C', length: 20, decimals: 0 },
      { name: 'FCUFCRM', type: 'C', length: 2, decimals: 0 },
      { name: 'FCTIPOCRM', type: 'C', length: 1, decimals: 0 },
      { name: 'FCVLRCART', type: 'N', length: 12, decimals: 2 },
      { name: 'DTRECEITA', type: 'D', length: 8, decimals: 0 },
      { name: 'CPFCLI', type: 'N', length: 14, decimals: 0 },
      { name: 'NFCEDEV', type: 'N', length: 9, decimals: 0 },
      { name: 'NFCESER', type: 'N', length: 3, decimals: 0 },
      { name: 'NFCEFIL', type: 'N', length: 3, decimals: 0 },
      { name: 'PREVENCIDO', type: 'N', length: 6, decimals: 0 },
      { name: 'FORMAENT', type: 'C', length: 1, decimals: 0 },
      { name: 'LOJAORI', type: 'N', length: 3, decimals: 0 },
      { name: 'DTENTREGA', type: 'C', length: 10, decimals: 0 },
      { name: 'HRENTREGA', type: 'C', length: 40, decimals: 0 },
      { name: 'ENCOMENDA', type: 'N', length: 3, decimals: 0 },
      { name: 'VDVD', type: 'C', length: 1, decimals: 0 },
      { name: 'LOTE', type: 'C', length: 20, decimals: 0 },
      { name: 'VALIDADE', type: 'C', length: 20, decimals: 0 },
      { name: 'IP', type: 'C', length: 20, decimals: 0 },
    ];

    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const dataAtual = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const horaAtual = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

    const clienteNome = cliente?.NOME || '';
    const cpfCliente = String(cliente?.CPF || cliente?.CPF_LIMPO || '').replace(/\D/g, '');
    const telefoneCompleto = String(cliente?.FONE || cliente?.CELULAR || '').replace(/\D/g, '');
    const rgCliente = String(cliente?.IDENTIDADE || '').replace(/\D/g, '');

    const records = [];

    const totalVenda = produtos.reduce((sum, p) => {
      const qtd = Number(p.quantidade || 0);
      const preco = Number(p.precoUnitario || 0);
      return sum + (qtd * preco);
    }, 0);
    const temPbmTrn = produtos.some((p) =>
      p?.PBM_TRN === true ||
      p?.pbm_trn === true ||
      p?.dadosControlado?.pbm_trn === true ||
      p?.dadosControlado?.PBM_TRN === true
    );
    const deliveryInfo = produtos.find((p) => p?.retirada) || null;
    const entregaData = deliveryInfo?.retirada?.data_entrega || '';
    const entregaHora = deliveryInfo?.retirada?.hora_entrega || '';
    const headerRecord = buildRecord(fieldDefs, {
      TIPO: 'C',
      VEND: funcionario?.CDFUN || '',
      CRM: clienteNome,
      DATA: dataAtual,
      HORA: horaAtual,
      PRECO: totalVenda,
      TRN: temPbmTrn ? 'P' : 'N',
      PHACPF: cpfCliente || '',
      PHTELCLI: telefoneCompleto || '',
      PHRGCLI: rgCliente || '',
      FCUFCRM: ufCrm || '',
      DTRECEITA: dataReceita ? dataReceita.replace(/-/g, '') : '',
      CPFCLI: cpfCliente || '',
    });
    records.push(headerRecord);

    produtos.forEach((produto) => {
      const dtReceitaProduto = produto?.dadosControlado?.dataReceita
        ? String(produto.dadosControlado.dataReceita).replace(/-/g, '')
        : '';

      const formaent = produto?.retirada?.formaent || (produto?.retirada ? 'R' : '');
      const lojaori = formaent === 'R' || formaent === 'C' ? (produto?.retirada?.loja_id || '') : '';
      const vdvd = formaent === 'R' && produto?.retirada?.vdvd ? 'S' : 'N';
      const lote = produto?.dadosControlado?.lote || '';
      const validade = produto?.dadosControlado?.validade || '';

      const record = buildRecord(fieldDefs, {
        TIPO: 'I',
        VEND: funcionario?.CDFUN || '',
        CODIGO: produto.CDPRODU,
        QUANT: produto.quantidade,
        PRECO: produto.precoUnitario,
        CRM: crmMedico || '',
        DATA: dataAtual,
        HORA: horaAtual,
        PHACPF: cpfCliente,
        PHTELCLI: telefoneCompleto,
        PHRGCLI: rgCliente,
        FCUFCRM: ufCrm || '',
        FCDTRECEI: dtReceitaProduto ? `${dtReceitaProduto.slice(0,4)}-${dtReceitaProduto.slice(4,6)}-${dtReceitaProduto.slice(6,8)}` : '',
        DTRECEITA: dtReceitaProduto || '',
        FORMAENT: formaent,
        LOJAORI: lojaori,
        ENCOMENDA: 0,
        VDVD: vdvd,
        LOTE: lote,
        VALIDADE: validade,
      });
      records.push(record);
    });

    const fechamento = buildRecord(fieldDefs, {
      TIPO: 'F',
      VEND: 1,
      DATA: dataAtual,
      HORA: horaAtual,
      TRN: 'N',
      DTENTREGA: entregaData,
      HRENTREGA: entregaHora,
    });
    records.push(fechamento);

    if (cliente) {
      const endereco = [
        cliente?.ENDE,
        cliente?.NRENDE,
        cliente?.COMPL
      ].filter(Boolean).join(' ');
      const yCampos = [
        clienteNome || '',
        cliente?.FONE || cliente?.CELULAR || '',
        endereco || '',
        cliente?.BAIR || '',
        cliente?.CIDA || '',
        cpfCliente || '',
        '',
      ];

      yCampos.forEach((valor, idx) => {
        const y = buildRecord(fieldDefs, {
          TIPO: 'Y',
          CODIGO: idx + 1,
          CRM: valor || '',
        });
        records.push(y);
      });
    }

    const fileBytes = buildDbf(fieldDefs, records);
    const nameInfo = buildDbfFilename();
    const blob = new Blob([fileBytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    return {
      success: true,
      arquivo: nameInfo.filename,
      codigo: nameInfo.codigo,
      total_produtos: produtos.length,
      url,
    };
  }

  const buildRecord = (fieldDefs, values) => {
    let out = String.fromCharCode(0x20);
    fieldDefs.forEach((f) => {
      out += formatField(values[f.name], f);
    });
    return out;
  };

  const formatField = (value, field) => {
    const { type, length, decimals } = field;
    if (type === 'C') {
      const str = value == null ? '' : String(value);
      const trimmed = str.length > length ? str.slice(0, length) : str;
      return trimmed.padEnd(length, ' ');
    }
    if (type === 'N') {
      if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) {
        return ' '.repeat(length);
      }
      const num = Number(value);
      const formatted = Number.isFinite(num)
        ? (decimals > 0 ? num.toFixed(decimals) : String(Math.trunc(num)))
        : '';
      const clean = formatted.replace(',', '.');
      return clean.padStart(length, ' ').slice(-length);
    }
    if (type === 'D') {
      const str = value == null ? '' : String(value);
      if (!str) return ' '.repeat(8);
      return str.padEnd(8, ' ').slice(0, 8);
    }
    return ' '.repeat(length);
  };

  const buildDbfFilename = () => {
    const key = 'dbf_seq_prevenda';
    const raw = localStorage.getItem(key);
    const base = Number.isFinite(Number(raw)) ? Number(raw) : 900000;
    const next = base;
    const nextValue = base + 1;
    localStorage.setItem(key, String(nextValue));
    return {
      filename: `C${String(next).padStart(6, '0')}.DBF`,
      codigo: String(next).padStart(6, '0'),
    };
  };

  function buildDbf(fieldDefs, records) {
    const recordLength = 1 + fieldDefs.reduce((acc, f) => acc + f.length, 0);
    const headerLength = 32 + (fieldDefs.length * 32) + 1;
    const numRecords = records.length;

    const header = [];
    header.push(0x03);
    const now = new Date();
    header.push(now.getFullYear() - 1900);
    header.push(now.getMonth() + 1);
    header.push(now.getDate());
    header.push(...toUint32LE(numRecords));
    header.push(...toUint16LE(headerLength));
    header.push(...toUint16LE(recordLength));
    header.push(...new Array(20).fill(0));

    const fields = [];
    fieldDefs.forEach((f) => {
      const nameBytes = encodeLatin1(f.name.padEnd(11, '\0').slice(0, 11));
      fields.push(...nameBytes);
      fields.push(f.type.charCodeAt(0));
      fields.push(...[0, 0, 0, 0]);
      fields.push(f.length);
      fields.push(f.decimals || 0);
      fields.push(...new Array(14).fill(0));
    });
    fields.push(0x0D);

    const recBytes = [];
    records.forEach((r) => {
      recBytes.push(...encodeLatin1(r));
    });
    recBytes.push(0x1A);

    return new Uint8Array([...header, ...fields, ...recBytes]);
  }

  const toUint16LE = (v) => [v & 0xff, (v >> 8) & 0xff];
  const toUint32LE = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
  const encodeLatin1 = (str) => {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
      const code = str.charCodeAt(i);
      bytes[i] = code <= 255 ? code : 63;
    }
    return bytes;
  };

  function imprimirComprovantePrevenda({ codigo, funcionario, cliente, produtos }) {
    try {
      const total = produtos.reduce((sum, p) => sum + (p.total || 0), 0);
      const now = new Date();
      const pad2 = (n) => String(n).padStart(2, '0');
      const data = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
      const hora = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const itensHtml = produtos.map((p) => `
        <div class="item">
          <div class="item-nome">${String(p.NOME || '').slice(0, 48)}</div>
          <div class="item-linha">
            <span>${p.quantidade} x ${formatMoney(p.precoUnitario)}</span>
            <span>${formatMoney(p.total)}</span>
          </div>
          ${p.retirada ? `<div class="item-retirada">Retirada: ${p.retirada.loja_id}${p.retirada.loja_nome ? ` - ${formatLojaNome(p.retirada.loja_nome)}` : ''} (Qtd: ${p.retirada.quantidade})</div>` : ''}
        </div>
      `).join('');

      const html = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Pré-venda ${codigo}</title>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
          <style>
            @page { size: 80mm auto; margin: 6mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #111; }
            .wrap { width: 100%; }
            .center { text-align: center; }
            .title { font-size: 14px; font-weight: 700; }
            .sub { font-size: 12px; }
            .hr { border-top: 1px dashed #333; margin: 8px 0; }
            .line { display: flex; justify-content: space-between; font-size: 12px; }
            .item { margin-bottom: 6px; }
            .item-nome { font-size: 12px; font-weight: 600; }
            .item-linha { display: flex; justify-content: space-between; font-size: 12px; }
            .item-retirada { font-size: 11px; color: #2563eb; margin-top: 2px; }
            .barcode { font-family: 'Libre Barcode 39', monospace; font-size: 36px; line-height: 1; }
            .small { font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="center title">PRÉ-VENDA</div>
            <div class="center sub">Código: C${codigo}</div>
            <div class="center barcode">*C${codigo}*</div>
            <div class="center small">${data} ${hora}</div>
            <div class="hr"></div>
            <div class="line"><span>Atendente:</span><span>${funcionario?.NOME || ''}</span></div>
            ${cliente ? `<div class="line"><span>Cliente:</span><span>${cliente?.NOME || ''}</span></div>` : ''}
            <div class="hr"></div>
            ${itensHtml}
            <div class="hr"></div>
            <div class="line"><strong>Total</strong><strong>${formatMoney(total)}</strong></div>
            <div class="hr"></div>
            <div class="center small">Levar este comprovante para finalizar.</div>
          </div>
          <script>
            setTimeout(() => { window.print(); }, 200);
            window.onafterprint = () => window.close();
          </script>
        </body>
        </html>
      `;

      const win = window.open('', '_blank', 'width=400,height=600');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error('Falha ao imprimir comprovante:', e);
    }
  }

  // Gerar arquivo DBF
  const gerarDbf = useCallback(async () => {
    if (!funcionario) {
      setErroToast('Selecione um funcionário');
      return;
    }

    if (produtos.length === 0) {
      setErroToast('Adicione pelo menos um produto');
      return;
    }

    setGerandoDbf(true);
    setErro('');

    try {
      const produtosParaDbf = produtos.map(p => ({
        CDPRODU: p.CDPRODU,
        quantidade: p.quantidade,
        precoUnitario: p.precoUnitario,
        dadosControlado: p.dadosControlado || null
      }));

      const resultado = gerarDbfLocal({
        funcionario,
        cliente,
        produtos: produtosParaDbf,
        dataReceita,
        crmMedico,
        ufCrm
      });

      const link = document.createElement('a');
      link.href = resultado.url;
      link.download = resultado.arquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(resultado.url);

      imprimirComprovantePrevenda({
        codigo: resultado.codigo,
        funcionario,
        cliente,
        produtos,
      });

      setProdutos([]);
      setCliente(null);
      setCpfCliente('');
      setDataReceita('');
      setCrmMedico('');
      setUfCrm('PR');

      alert(`DBF gerado com sucesso!\n\nArquivo: ${resultado.arquivo}\nTotal de produtos: ${resultado.total_produtos}`);
    } catch (error) {
      console.error('Erro ao gerar DBF:', error);
      setErroToast('Erro ao gerar DBF: ' + error.message);
    } finally {
      setGerandoDbf(false);
    }
  }, [funcionario, produtos, cliente, dataReceita, crmMedico, ufCrm, gerarDbfLocal, imprimirComprovantePrevenda, setErroToast]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (showDropdown && produtosDropdown.length > 0 && (e.key === 'F6' || e.key === 'F5')) {
        // evita dropdown ficar por trás quando abrir outras janelas
        setShowDropdown(false);
      }
      if (showCancelModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowCancelModal(false);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          resetPrevenda();
          setShowCancelModal(false);
          return;
        }
      }
      if (showDeleteModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowDeleteModal(false);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (produtoSelecionado != null) {
            removerProduto(produtoSelecionado);
          }
          setShowDeleteModal(false);
          return;
        }
      }
      if (showTokenModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowTokenModal(false);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          aplicarToken();
          return;
        }
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setShowCancelModal(true);
        return;
      }
      if (e.key === 'Escape') {
        if (showEstoque) {
          setShowEstoque(false);
          return;
        }
        if (showPreco) {
          setShowPreco(false);
          return;
        }
      }
      if (e.key === 'F2') {
        e.preventDefault();
        if (gerandoDbf) return;
        if (!funcionario || produtos.length === 0) {
          setErroToast('Selecione funcionário e adicione produtos antes de gerar');
          return;
        }
        gerarDbf();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (produtoSelecionado == null || !produtos[produtoSelecionado]) {
          setErroToast('Selecione um produto para excluir');
          return;
        }
        setShowDeleteModal(true);
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        const dropdownSelected = showDropdown && produtosDropdown.length > 0 ? (produtosDropdown[dropdownIndex] || produtosDropdown[0]) : null;
        const rawValor = dropdownSelected?.CDPRODU ? String(dropdownSelected.CDPRODU) : String(codigoProduto || '').trim();
        const valorLimpo = rawValor.replace(/\\D/g, '');
        const valor = valorLimpo || rawValor;
        const isNumero = /^\\d+$/.test(valorLimpo);
        setShowDropdown(false);
        if (dropdownSelected?.CDPRODU) {
          setCodigoProduto(String(dropdownSelected.CDPRODU));
        }
        setPrecoCodigoInicial(valor);
        setPrecoAutoBuscar(Boolean(valorLimpo && isNumero));
        setShowPreco(true);
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        const dropdownSelected = showDropdown && produtosDropdown.length > 0 ? (produtosDropdown[dropdownIndex] || produtosDropdown[0]) : null;
        const selected = dropdownSelected || (produtoSelecionado != null ? produtos[produtoSelecionado] : null);
        const codigo = selected?.CDPRODU || String(codigoProduto || '').trim();
        if (!codigo) {
          setErroToast('Informe um código ou selecione um produto para consultar estoque');
          return;
        }
        setShowDropdown(false);
        if (selected?.CDPRODU) {
          setCodigoProduto(String(selected.CDPRODU));
        }
        setEstoqueCodigoInicial(String(codigo));
        setShowEstoque(true);
        return;
      }
      if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        if (produtoSelecionado == null || !produtos[produtoSelecionado]) {
          setErroToast('Selecione um produto para escolher retirada (Ctrl+E)');
          return;
        }
        abrirRetiradaModal(produtos[produtoSelecionado], produtoSelecionado);
      }
      if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        if (produtoSelecionado == null || !produtos[produtoSelecionado]) {
          setErroToast('Selecione um produto para aplicar token');
          return;
        }
        if (!cliente) {
          setErroToast('Informe o cliente antes de usar token');
          return;
        }
        setTokenValue('');
        setShowTokenModal(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showCancelModal,
    showDeleteModal,
    showTokenModal,
    showEstoque,
    showPreco,
    gerandoDbf,
    funcionario,
    produtos,
    codigoProduto,
    produtoSelecionado,
    showDropdown,
    produtosDropdown,
    dropdownIndex,
    abrirRetiradaModal,
    aplicarToken,
    cliente,
    gerarDbf,
    removerProduto,
    setErroToast,
  ]);

  const formatMoney = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(Number(value || 0));

  // Calcular totais
  const totalGeral = produtos.reduce((sum, p) => sum + p.total, 0);
  const totalSemDesconto = produtos.reduce((sum, p) => {
    const precoBase = parseFloat(p.PRECO_SEM_DESCONTO || p.PRECO || 0);
    const qtd = Number(p.quantidade || 0);
    return sum + (precoBase * qtd);
  }, 0);
  const totalEconomia = Math.max(0, totalSemDesconto - totalGeral);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll para o último item ao adicionar produto
  useEffect(() => {
    if (!produtosTableRef.current) return;
    produtosTableRef.current.scrollTop = produtosTableRef.current.scrollHeight;
  }, [produtos.length]);

  // Fechar dropdown ao abrir janelas
  useEffect(() => {
    if (showEstoque || showPreco) {
      setShowDropdown(false);
    }
  }, [showEstoque, showPreco]);

  const content = (
    <div className={embedded ? 'preco-standalone' : undefined}>
      {embedded && (
        <div style={{ display: 'none' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
        <img
          src={`${process.env.PUBLIC_URL || ''}/logo-call.webp`}
          alt="Call"
          style={{ height: '32px', opacity: 0.85 }}
        />
      </div>
      <style>{`
        @keyframes bannerFade {
          from { opacity: 0.2; transform: scale(1.01); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {/* Funcionário + Cliente + Receita (linha única) */}
      <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 28px 180px 120px 28px 180px 110px 110px 120px', columnGap: '10px', rowGap: '6px', alignItems: 'center' }}>
          <input
            ref={matriculaRef}
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            placeholder="Matrícula"
            autoComplete="off"
            maxLength={5}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            onKeyDown={(e) => e.key === 'Enter' && buscarFuncionario()}
          />
          <button
            onClick={buscarFuncionario}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title="Buscar funcionário"
          >
            <i className="fas fa-search"></i>
          </button>
          <div
            style={{
              padding: '8px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              background: '#f9fafb',
              fontSize: '13px',
              fontWeight: '600',
              color: funcionario ? '#059669' : '#9ca3af',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {funcionario ? funcionario.NOME : '—'}
          </div>
          <input
            ref={cpfClienteRef}
            type="text"
            value={cpfCliente}
            onChange={(e) => setCpfCliente(formatCpf(e.target.value))}
            placeholder="CPF"
            autoComplete="off"
            maxLength={14}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            onKeyDown={(e) => e.key === 'Enter' && buscarCliente()}
          />
          <button
            onClick={buscarCliente}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title="Buscar cliente"
          >
            <i className="fas fa-search"></i>
          </button>
          <div
            style={{
              padding: '8px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              background: '#f9fafb',
              fontSize: '13px',
              fontWeight: '600',
              color: cliente ? '#059669' : '#9ca3af',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {cliente ? cliente.NOME : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right' }}>
            Data da receita
          </div>
          <input
            ref={dataReceitaRef}
            type="date"
            value={dataReceita}
            onChange={(e) => setDataReceita(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                e.preventDefault();
                crmMedicoRef.current?.focus();
              }
            }}
          />
          <input
            ref={crmMedicoRef}
            type="text"
            value={crmMedico}
            onChange={(e) => setCrmMedico(e.target.value)}
            placeholder="CRM"
            autoComplete="off"
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                e.preventDefault();
                codigoProdutoRef.current?.focus();
              }
            }}
          />
        </div>
      </div>

      {/* Banners de oferta */}
      <div style={{ marginBottom: '16px' }}>
        {bannersLoading && (
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Carregando ofertas...</div>
        )}
        {bannersError && (
          <div style={{ fontSize: '12px', color: '#ef4444' }}>{bannersError}</div>
        )}
        {!bannersLoading && !bannersError && banners.length > 0 && (
          <div style={{
            width: '100%',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
          }}>
            <img
              key={bannerKey}
              src={banners[bannerIndex]?.imagem}
              alt={banners[bannerIndex]?.titulo || 'Oferta'}
              onClick={() => banners[bannerIndex]?.link && window.open(banners[bannerIndex].link, '_blank')}
              style={{
                width: '100%',
                objectFit: 'cover',
                display: 'block',
                cursor: banners[bannerIndex]?.link ? 'pointer' : 'default',
                animation: 'bannerFade 0.6s ease'
              }}
            />
          </div>
        )}
      </div>

      {/* Adicionar Produto */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '2px solid #3b82f6', marginBottom: '20px', position: 'relative' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
          <i className="fas fa-plus-circle" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
          Adicionar Produto
        </h4>
      <div style={{ display: 'flex', gap: '8px', position: 'relative' }} ref={dropdownRef}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={codigoProdutoRef}
            type="text"
            value={codigoProduto}
            onChange={(e) => setCodigoProduto(e.target.value)}
            placeholder="Código ou nome do produto"
            autoComplete="off"
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            onKeyDown={(e) => {
              if (showDropdown && produtosDropdown.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setDropdownIndex((idx) => Math.min(produtosDropdown.length - 1, idx + 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setDropdownIndex((idx) => Math.max(0, idx - 1));
                  return;
                }
                if (e.key === 'F6') {
                  e.preventDefault();
                  const selected = produtosDropdown[dropdownIndex] || produtosDropdown[0];
                  if (selected?.CDPRODU) {
                    setShowDropdown(false);
                    setCodigoProduto(String(selected.CDPRODU));
                    setEstoqueCodigoInicial(String(selected.CDPRODU));
                    setShowEstoque(true);
                  }
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const selected = produtosDropdown[dropdownIndex] || produtosDropdown[0];
                  if (selected) {
                    adicionarProduto(selected);
                    setCodigoProduto('');
                    setShowDropdown(false);
                  }
                  return;
                }
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                const isNumero = /^\d+$/.test(codigoProduto);

                  if (isNumero) {
                    // Se for número, adicionar produto direto
                    adicionarProduto();
                  } else {
                    // Se for texto e tem dropdown aberto, adicionar o primeiro produto
                    if (showDropdown && produtosDropdown.length > 0) {
                      adicionarProduto(produtosDropdown[0]);
                      setCodigoProduto('');
                      setShowDropdown(false);
                    } else if (codigoProduto.trim()) {
                      // Se não tem dropdown, forçar a busca
                      pesquisarProdutosDropdown(codigoProduto);
                    }
                  }
                }
              }}
            />

            {/* Dropdown de resultados */}
            {showDropdown && produtosDropdown.length > 0 && (
              <div
                ref={dropdownRef}
                style={{
                  display: 'block',
                  position: 'fixed',
                  top: `${dropdownPos.top}px`,
                  left: `${dropdownPos.left}px`,
                  width: `${dropdownPos.width}px`,
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  marginTop: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 50000,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                {produtosDropdown.map((prod, idx) => {
                  const estoque = parseFloat(prod.ESTOQUE || 0);
                  const temEstoque = estoque > 0;

                  // Se PRECO for 0, usar PRECO_SEM_DESCONTO
                  let precoExibir = parseFloat(prod.PRECO || 0);
                  if (precoExibir === 0) {
                    precoExibir = parseFloat(prod.PRECO_SEM_DESCONTO || 0);
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        adicionarProduto(prod);
                        setCodigoProduto('');
                        setShowDropdown(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderBottom: idx < produtosDropdown.length - 1 ? '1px solid #f3f4f6' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        background: dropdownIndex === idx ? '#eef2ff' : 'white'
                      }}
                      onMouseEnter={() => setDropdownIndex(idx)}
                    >
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827', marginBottom: '4px' }}>
                        {prod.CDPRODU} - {prod.NOME}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: temEstoque ? '#10b981' : '#ef4444'
                          }}></span>
                          Estoque: <strong style={{ color: temEstoque ? '#10b981' : '#ef4444' }}>{estoque.toFixed(0)}</strong>
                        </span>
                        <span>Preço: <strong className="currency">R$ {precoExibir.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setModalPesquisa(true)}
            style={{
              padding: '8px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <i className="fas fa-search"></i> Pesquisar
          </button>
          <button
            onClick={() => adicionarProduto()}
            disabled={!codigoProduto}
            style={{
              padding: '8px 16px',
              background: codigoProduto ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: codigoProduto ? 'pointer' : 'not-allowed'
            }}
          >
            <i className="fas fa-plus"></i> Adicionar
          </button>
        </div>
      </div>

      {/* feedback via toast */}

      {/* Lista de Produtos */}
      <div
        className="excel-table-container"
        ref={produtosTableRef}
        style={{
          marginBottom: '20px',
          height: '235px',
          maxHeight: '235px',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
          <table className="excel-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Código</th>
                <th>Produto</th>
                <th className="text-right" style={{ width: '110px' }}>Preço s/ Desc</th>
                <th className="text-right" style={{ width: '110px' }}>Preço c/ Desc</th>
                <th className="text-center" style={{ width: '80px' }}>Qtd</th>
                <th className="text-right" style={{ width: '110px' }}>Total</th>
                <th className="text-center" style={{ width: '50px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto, index) => {
                const precoSemDesc = parseFloat(produto.PRECO_SEM_DESCONTO || produto.PRECO || 0);
                const precoComDesc = parseFloat(produto.precoUnitario || produto.PRECO || 0);
                const temDesconto = precoComDesc < precoSemDesc;

                return (
                  <tr
                    key={index}
                    onClick={() => setProdutoSelecionado(index)}
                    style={{
                      cursor: 'pointer',
                      background: produtoSelecionado === index ? '#eef2ff' : 'transparent'
                    }}
                  >
                    <td>{produto.CDPRODU}</td>
                    <td>
                      <div>{produto.NOME}</div>
                      {produto.tokenAplicado && (
                        <div style={{ fontSize: '10px', color: '#d97706', marginTop: '2px', fontWeight: '600' }}>
                          Cobertura de Preço
                        </div>
                      )}
                      {produto.promocaoAplicada && produto.kitQtd > 0 && (
                        <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px', fontWeight: '600' }}>
                          <i className="fas fa-tag"></i> Promoção: Leve {produto.kitQtd}+ por R$ {parseFloat(produto.precoKit).toFixed(2)}/un
                        </div>
                      )}
                      {!produto.promocaoAplicada && produto.kitQtd > 0 && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                          <i className="fas fa-tag"></i> Promoção disponível ({produto.kitQtd}+ un)
                        </div>
                      )}
                      {produto.retirada && (
                        <div style={{ fontSize: '10px', color: '#2563eb', marginTop: '2px', fontWeight: '600' }}>
                          <i className="fas fa-store"></i> Retirada: {produto.retirada.loja_id} {produto.retirada.loja_nome ? `- ${formatLojaNome(produto.retirada.loja_nome)}` : ''} (Qtd: {produto.retirada.quantidade})
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>
                        R$ {precoSemDesc.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right currency" style={{ fontWeight: temDesconto ? '700' : '500' }}>
                      <span style={{ color: temDesconto ? '#059669' : '#374151' }}>
                        R$ {precoComDesc.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-center">
                      <input
                        type="number"
                        value={produto.quantidade}
                        onChange={(e) => atualizarQuantidade(index, e.target.value)}
                        min="1"
                        style={{
                          width: '50px',
                          padding: '4px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '12px'
                        }}
                      />
                    </td>
                    <td className="text-right currency" style={{ fontWeight: '700', fontSize: '13px' }}>
                      R$ {produto.total.toFixed(2)}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removerProduto(index)}
                        style={{
                          padding: '4px 8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {Array.from({ length: Math.max(0, 6 - produtos.length) }).map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td style={{ height: '34px' }}></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {showRetirada && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '10px',
            width: '420px',
            padding: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{retiradaProdutoTemp ? 'Estoque na rede (F6)' : 'Retirada (Ctrl+E)'}</strong>
              <button
                onClick={() => {
                  setShowRetirada(false);
                  setRetiradaProdutoTemp(null);
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
              {retiradaProdutoTemp ? 'Consulta de estoque por loja.' : 'Selecione a loja e a quantidade para retirada.'}
            </div>

            {retiradaErro && (
              <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '12px' }}>{retiradaErro}</div>
            )}

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>Loja com estoque</label>
              <select
                value={retiradaLoja}
                onChange={(e) => setRetiradaLoja(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                {retiradaLoading && <option>Carregando...</option>}
                {!retiradaLoading && retiradaLojas.length === 0 && <option value="">Nenhuma loja encontrada</option>}
                {!retiradaLoading && retiradaLojas.map((l) => (
                  <option key={l.loja_id} value={l.loja_id}>
                    {l.loja_id} {l.loja_nome ? `- ${l.loja_nome}` : ''} (Estoque: {Number(l.estoque || 0)})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>Quantidade</label>
              <input
                type="number"
                min="1"
                value={retiradaQuantidade}
                onChange={(e) => setRetiradaQuantidade(e.target.value)}
                max={Math.max(1, Number((produtos[produtoSelecionado] || retiradaProdutoTemp)?.quantidade || 1))}
                disabled={Boolean(retiradaProdutoTemp)}
                style={{ width: '100%', marginTop: '6px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowRetirada(false);
                  setRetiradaProdutoTemp(null);
                }}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff' }}
              >
                Cancelar
              </button>
              {!retiradaProdutoTemp && (
                <button
                  onClick={confirmarRetirada}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '600' }}
                >
                  Confirmar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Total */}
      <div style={{
        background: '#f9fafb',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '2px solid #10b981',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '10px',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>De:</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#9ca3af', textDecoration: 'line-through' }}>
            R$ {totalSemDesconto.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Por:</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
            R$ {totalGeral.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Você economizou:</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>
            R$ {totalEconomia.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Botões */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => {
            setShowCancelModal(true);
          }}
          style={{
            padding: '10px 18px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fas fa-times"></i> Cancelar pré-venda (F9)
        </button>
        <button
          onClick={() => {
            const valor = String(codigoProduto || '').trim();
            const isNumero = /^\d+$/.test(valor.replace(/\D/g, ''));
            setShowDropdown(false);
            setPrecoCodigoInicial(valor.replace(/\D/g, '') || valor);
            setPrecoAutoBuscar(Boolean(valor && isNumero));
            setShowPreco(true);
          }}
          style={{
            padding: '10px 18px',
            background: '#f59e0b',
            color: '#111827',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fas fa-search"></i> Consulta (F5)
        </button>
        <button
          onClick={gerarDbf}
          disabled={gerandoDbf || !funcionario || produtos.length === 0}
          style={{
            padding: '12px 24px',
            background: (gerandoDbf || !funcionario || produtos.length === 0) ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: (gerandoDbf || !funcionario || produtos.length === 0) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!(gerandoDbf || !funcionario || produtos.length === 0)) e.currentTarget.style.background = '#2563eb';
          }}
          onMouseLeave={(e) => {
            if (!(gerandoDbf || !funcionario || produtos.length === 0)) e.currentTarget.style.background = '#3b82f6';
          }}
        >
          <i className={gerandoDbf ? 'fas fa-spinner fa-spin' : 'fas fa-file-export'}></i>
          {gerandoDbf ? 'Finalizando...' : 'Finalizar (F2)'}
        </button>
      </div>

      {/* Modal de Produto Controlado */}
      {modalControlado && produtoControlado && (
        <div
          onClick={() => {
            setModalControlado(false);
            setProdutoControlado(null);
            setLoteControlado('');
            setValidadeControlado('');
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '8px',
              width: '500px',
              maxWidth: '90%',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              border: '2px solid #ef4444'
            }}
          >
            <div style={{ padding: '16px', borderBottom: '2px solid #ef4444', background: '#fee2e2' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-exclamation-triangle"></i>
                Produto Controlado
              </h3>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                  {produtoControlado.CDPRODU} - {produtoControlado.NOME}
                </div>
              </div>

              {erro && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                  <i className="fas fa-exclamation-circle"></i> {erro}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Data da Receita *
                  </label>
                  <input
                    ref={dataReceitaModalRef}
                    type="date"
                    value={dataReceita}
                    onChange={(e) => setDataReceita(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                        e.preventDefault();
                        crmModalRef.current?.focus();
                      }
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    CRM *
                  </label>
                  <input
                    ref={crmModalRef}
                    type="text"
                    value={crmMedico}
                    onChange={(e) => setCrmMedico(e.target.value)}
                    placeholder="CRM do médico"
                    autoComplete="off"
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                        e.preventDefault();
                        ufModalRef.current?.focus();
                      }
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    UF *
                  </label>
                  <input
                    ref={ufModalRef}
                    type="text"
                    value={ufCrm}
                    onChange={(e) => setUfCrm(e.target.value.toUpperCase())}
                    placeholder="PR"
                    maxLength="2"
                    autoComplete="off"
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textTransform: 'uppercase' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                        e.preventDefault();
                        loteModalRef.current?.focus();
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Lote *
                  </label>
                  <input
                    ref={loteModalRef}
                    type="text"
                    value={loteControlado}
                    onChange={(e) => setLoteControlado(e.target.value)}
                    placeholder="Lote do produto"
                    autoComplete="off"
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                        e.preventDefault();
                        validadeModalRef.current?.focus();
                      }
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Validade *
                  </label>
                  <input
                    ref={validadeModalRef}
                    type="date"
                    value={validadeControlado}
                    onChange={(e) => setValidadeControlado(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                        e.preventDefault();
                        confirmarProdutoControlado();
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setModalControlado(false);
                    setProdutoControlado(null);
                    setLoteControlado('');
                    setValidadeControlado('');
                    setErro('');
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarProdutoControlado}
                  style={{
                    padding: '10px 20px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fas fa-check"></i> Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pesquisa */}
      {modalPesquisa && (
        <div
          onClick={() => setModalPesquisa(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '8px',
              width: '600px',
              maxWidth: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>Pesquisar Produto</h3>
              <button
                onClick={() => setModalPesquisa(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer', padding: 0, width: '24px', height: '24px' }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <input
                type="text"
                value={termoPesquisa}
                onChange={(e) => {
                  setTermoPesquisa(e.target.value);
                  pesquisarProdutos(e.target.value);
                }}
                placeholder="Digite o nome do produto..."
                autoComplete="off"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                autoFocus
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {carregandoPesquisa && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  <i className="fas fa-spinner fa-spin"></i> Buscando...
                </div>
              )}
              {!carregandoPesquisa && !termoPesquisa && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Digite para pesquisar...
                </div>
              )}
              {!carregandoPesquisa && termoPesquisa && produtosPesquisa.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Nenhum produto encontrado
                </div>
              )}
              {!carregandoPesquisa && produtosPesquisa.length > 0 && (
                <div>
                  {produtosPesquisa.map((produto, index) => (
                    <div
                      key={index}
                      onClick={() => adicionarProduto(produto)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                        {produto.CDPRODU} - {produto.NOME}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'flex', gap: '16px' }}>
                        <span>Estoque: {produto.ESTOQUE || 0}</span>
                        <span className="currency">Preço: R$ {parseFloat(produto.PRECO || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPreco && (
        <WindowPreco
          userData={userData}
          initialCodigo={precoCodigoInicial}
          autoBuscar={precoAutoBuscar}
          onOpenEstoque={(codigo) => {
            if (codigo) {
              setEstoqueCodigoInicial(String(codigo));
              setShowEstoque(true);
            }
          }}
          onAddProduct={(codigo) => {
            if (codigo) {
              adicionarProduto(null, String(codigo));
            }
          }}
          onClose={() => setShowPreco(false)}
          onFocus={() => {}}
          zIndex={2000}
        />
      )}

      {showEstoque && (
        <WindowEstoque
          userData={userData}
          autoSearchCode={estoqueCodigoInicial}
          readOnly
          onClose={() => setShowEstoque(false)}
          onFocus={() => {}}
          zIndex={2100}
        />
      )}

      {showCancelModal && (
        <div
          onClick={() => setShowCancelModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
              padding: '18px'
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Cancelar pré-venda
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              Deseja cancelar a pré-venda? Todos os dados serão apagados.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Não
              </button>
              <button
                ref={cancelConfirmBtnRef}
                onClick={() => {
                  resetPrevenda();
                  setShowCancelModal(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
              padding: '18px'
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Excluir item
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              Deseja excluir o item selecionado?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Não
              </button>
              <button
                onClick={() => {
                  if (produtoSelecionado != null) {
                    removerProduto(produtoSelecionado);
                  }
                  setShowDeleteModal(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showTokenModal && (
        <div
          onClick={() => setShowTokenModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
              padding: '18px'
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Inserir Token
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              Produto: {produtos[produtoSelecionado]?.NOME || ''}
            </div>
            <input
              type="text"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Digite o token"
              autoFocus
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => setShowTokenModal(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={aplicarToken}
                disabled={tokenLoading}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: tokenLoading ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  fontWeight: '700',
                  cursor: tokenLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removerToast} />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DraggableWindow
      title="Simulador de Venda (Pré-venda)"
      icon="fa-cash-register"
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={1000}
      initialTop={60}
      initialLeft={200}
    >
      {content}
    </DraggableWindow>
  );
};

export default WindowSimulador;
