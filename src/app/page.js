"use client"

import React, { useState, useEffect } from 'react';
import { FileUp, Loader2, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import TransactionViewer from './components/TransactionViewer';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conversionStatus, setConversionStatus] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success', 'error', 'info'
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('full');
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [extractedTransactions, setExtractedTransactions] = useState([]);
  const [showTransactionViewer, setShowTransactionViewer] = useState(false);

  useEffect(() => {
    // Carrega o PDF.js via CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfJsLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleFileSelect = (event) => {
    const file = event?.target?.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setSelectedFile(file);
      setConversionStatus('');
      setStatusType('');
    } else if (file) {
      setSelectedFile(null);
      setConversionStatus('Por favor, selecione um arquivo PDF válido.');
      setStatusType('error');
    }
  };

  const handleConversion = async () => {
    if (!selectedFile) {
      setConversionStatus('Por favor, selecione um arquivo primeiro.');
      setStatusType('error');
      return;
    }

    if (!pdfJsLoaded) {
      setConversionStatus('Aguarde o carregamento do sistema...');
      setStatusType('info');
      return;
    }

    setIsProcessing(true);
    setConversionStatus('Processando arquivo...');
    setStatusType('info');

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      // Extrair texto de todas as páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Organizar os itens por posição Y para manter a ordem das linhas
        const textItems = textContent.items.sort((a, b) => 
          b.transform[5] - a.transform[5]
        );
        
        let lastY = null;
        let line = '';
        
        // Agrupar texto por linha
        for (const item of textItems) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            // Nova linha
            fullText += line.trim() + '\n';
            line = '';
          }
          
          line += item.str + ' ';
          lastY = item.transform[5];
        }
        
        // Adicionar a última linha
        if (line.trim()) {
          fullText += line.trim() + '\n';
        }
      }

      console.log("Texto extraído:", fullText);

      // Extrair informações da conta e saldo
      let accountNumber = "62909-X";
      let agencia = "2901-7";
      let periodStart = "20250201";
      let periodEnd = "20250224";
      let balance = "0.00";

      // Tentar extrair número da conta e agência
      const accountMatch = fullText.match(/Agência\s*\/\s*Conta\s*(\d+)[- ](\w+)/i);
      if (accountMatch) {
        agencia = accountMatch[1];
        accountNumber = accountMatch[2];
      }

      // Tentar extrair datas do período
      const periodMatch = fullText.match(/Período\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (periodMatch) {
        periodStart = `${periodMatch[3]}${periodMatch[2]}${periodMatch[1]}`;
        periodEnd = `${periodMatch[6]}${periodMatch[5]}${periodMatch[4]}`;
      }

      // Tentar extrair saldo
      const balanceMatch = fullText.match(/Saldo:?\s*([\d.,]+)\s*([CD])/i);
      if (balanceMatch) {
        balance = balanceMatch[1].replace(/\./g, '').replace(',', '.');
        // Verificar se é débito
        if (balanceMatch[2] === 'D') {
          balance = `-${balance}`;
        }
      }

// Array para transações
const transactions = [];
let accountBalance = "0.00"; // Para armazenar o saldo da conta

// Dividir o texto em linhas para análise
const lines = fullText.split('\n');

// Buscar padrões de data e valores monetários
for (let i = 0; i < lines.length; i++) {
  const currentLine = lines[i].trim();
  
  // Pular linhas vazias
  if (!currentLine) continue;
  
  // Verificar se é uma linha de saldo
  const saldoMatch = currentLine.match(/Saldo:?\s*([\d.,]+)\s*([CD])/i) || 
                     currentLine.match(/Saldo atual\s*([\d.,]+)\s*([CD])/i) ||
                     currentLine.match(/Saldo total\s*([\d.,]+)\s*([CD])/i) ||
                     currentLine.match(/^Saldo bloqueado\s*([\d.,]+)\s*([CD])/i);
  
  if (saldoMatch) {
    // Extrair o valor do saldo
    accountBalance = saldoMatch[1].replace(/\./g, '').replace(',', '.');
    if (saldoMatch[2] === 'D') {
      accountBalance = `-${accountBalance}`;
    }
    console.log(`Saldo encontrado: ${accountBalance}`);
    continue; // Pular para próxima linha para não processar o saldo como transação
  }
  
  // Filtro mais abrangente para ignorar linhas de cabeçalho, rodapé ou informações de saldo
  if (currentLine.includes("Extratos - Poupança") || 
      currentLine.includes("Saldo bloqueado") ||
      currentLine.includes("Saldo total") ||
      currentLine.includes("Saldo atual") ||
      currentLine.match(/^Saldo:/) ||
      currentLine.match(/^Saldo [^:]*?[\d.,]+/) || // Qualquer linha começando com "Saldo" seguido de valor
      currentLine.includes("Período") ||
      currentLine.includes("Rendimentos:") ||
      currentLine.includes("Titularidade") ||
      currentLine.includes("Transação efetuada com sucesso") ||
      currentLine.includes("Serviço de Atendimento") ||
      currentLine.includes("Para deficientes auditivos") ||
      // Padrões que capturam linhas de saldo sem depender de valores específicos
      currentLine.match(/^Saldo[\s\w]*?:?\s*[\d.,]+\s*[CD]$/) ||
      // Linha que contém um valor monetário mas não tem data (DD/MM/YYYY)
      (currentLine.match(/[\d.,]+\s*[CD]$/) && !currentLine.match(/\d{2}\/\d{2}\/\d{4}/))) {
    continue;
  }
  
  // Procurar por padrão de data (DD/MM/YYYY)
  const dateMatch = currentLine.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  
  if (dateMatch) {
    const [_, day, month, year] = dateMatch;
    const date = `${year}${month}${day}`;
    
    // Procurar por valor monetário na linha atual ou nas 3 próximas linhas
    let valueStr = null;
    let creditDebit = null;
    let description = currentLine;
    let lineOffset = 0;
    
    // Primeiro verifica na linha atual
    const valueMatch = currentLine.match(/([\d.]+,\d{2})\s*([CD])?/);
    if (valueMatch) {
      valueStr = valueMatch[1];
      creditDebit = valueMatch[2] || '';
    } else {
      // Se não encontrou na linha atual, verifica nas próximas 3 linhas
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const nextLine = lines[i + j].trim();
        
        // Se for apenas "C" ou "D", é o indicador de débito/crédito
        if (nextLine === 'C' || nextLine === 'D') {
          creditDebit = nextLine;
          lineOffset = j;
          continue;
        }
        
        // Procura por um valor monetário
        const nextValueMatch = nextLine.match(/([\d.]+,\d{2})/);
        if (nextValueMatch) {
          valueStr = nextValueMatch[1];
          // Se já não temos creditDebit, procura na mesma linha
          if (!creditDebit) {
            const cdMatch = nextLine.match(/([\d.]+,\d{2})\s*([CD])/);
            if (cdMatch) {
              creditDebit = cdMatch[2];
            }
          }
          lineOffset = j;
          description += ' ' + nextLine;
          break;
        }
        
        // Acumular a descrição
        description += ' ' + nextLine;
      }
    }
    
    // Se encontrou um valor, cria uma transação
    if (valueStr) {
      // Verificar se a linha encontrada não é uma linha de saldo ou informativa
      if (description.includes("Saldo atual") || 
          description.includes("Saldo total") || 
          description.includes("Saldo bloqueado") ||
          description.match(/^Saldo:/) ||
          description.match(/Saldo[\s\w]*?:?\s*[\d.,]+\s*[CD]/) ||
          // Verifica se parece uma linha informativa de saldo (sem seguir padrão de transação)
          (!description.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}/) && 
           !description.includes("Pix") && 
           !description.includes("Juros") && 
           !description.includes("Reajuste") &&
           (description.match(/[\d.,]+\s*[CD]$/) || description.includes("Saldo")))) {
        console.log(`Ignorando linha de saldo ou informativa: ${description}`);
        i += lineOffset;
        continue;
      }
      
      // Processa o valor
      let value = valueStr.replace(/\./g, '').replace(',', '.');
      
      // Determina o tipo de transação
      let type = determineTransactionType(description);
      
      // Verifica se é um débito por tipo ou indicador
      const isDebit = creditDebit === 'D' || 
                      /transferência para|transferencia para|débito|pagamento de boleto|imposto|tarifa|compra com cartão|pix - enviado|saque/i.test(description);
      
      // Aplica sinal negativo para débitos
      if (isDebit && !value.startsWith('-')) {
        value = `-${value}`;
      }
      
      // Forçar tipo XFER para transações com "transferência" na descrição
      if (/transferência|transferencia/i.test(description)) {
        type = 'XFER';
      }
      
      // Cria um ID único
      const fitid = `${date}${Math.abs(parseFloat(value)).toString().replace('.', '')}`;
      
      // Verificação final: confirmar se temos um padrão de transação válida
      // Uma transação válida geralmente tem data, descrição específica e valor
      const isTaxaJuros = description.includes("Juros") || 
                          description.includes("Reajuste Monetário");
      const isPix = description.includes("Pix");
      const isTransferencia = /transferência|transferencia|transf/i.test(description);
      const isPagamento = /pagamento|pgto/i.test(description);
      
      // Se parece ser uma transação válida ou um tipo específico reconhecido
      if (isTaxaJuros || isPix || isTransferencia || isPagamento || 
          description.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}/)) {
        // Adiciona a transação
        transactions.push({
          date,
          type,
          value,
          memo: description.trim(),
          fitid
        });
      } else {
        console.log(`Ignorando possível linha não-transacional: ${description}`);
      }
      
      // Avança para além das linhas processadas
      i += lineOffset;
    }
  }
}

// Console para debug
console.log(`Encontradas ${transactions.length} transações.`);

// Ordenar transações por data
transactions.sort((a, b) => a.date.localeCompare(b.date));

// Função para determinar o tipo de transação
function determineTransactionType(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('pix')) return 'PIX';
  if (lowerText.includes('transferência') || lowerText.includes('transferencia') || lowerText.includes('transf')) return 'XFER';
  if (lowerText.includes('pagamento') || lowerText.includes('pgto')) return 'PAYMENT';
  if (lowerText.includes('dep') || lowerText.includes('depósito')) return 'DEP';
  if (lowerText.includes('compra') || lowerText.includes('cartão')) return 'DEBIT';
  if (lowerText.includes('juros')) return 'INT';
  if (lowerText.includes('reajuste')) return 'OTHER';
  
  return 'OTHER';
}

// Usar o saldo extraído ao invés de hardcoded no ofxContent:
// Antes de gerar o arquivo OFX, atualize a variável balance:
balance = accountBalance;

      // Verificar se encontramos transações
      if (transactions.length === 0) {
        setConversionStatus('Não foi possível encontrar transações no arquivo PDF. Verifique se o formato é compatível.');
        setStatusType('error');
        setIsProcessing(false);
        return;
      }

      // Salvar transações extraídas para visualização
      setExtractedTransactions(transactions);

      // Ordenar transações por data
      transactions.sort((a, b) => a.date.localeCompare(b.date));

      // Formatar as transações no formato OFX
      const formattedTransactions = transactions.map(t => `<STMTTRN>
<TRNTYPE>${t.type}
<DTPOSTED>${t.date}
<TRNAMT>${t.value}
<FITID>${t.fitid}
<MEMO>${t.memo}
</STMTTRN>`).join('\n');

      // Gerar o arquivo OFX completo
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<DTSERVER>${today}
<LANGUAGE>POR
<DTACCTUP>${today}
<FI>
<ORG>Banco do Brasil S/A
<FID>001
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>0
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>${accountNumber}
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${periodStart}
<DTEND>${periodEnd}
${formattedTransactions}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${balance}
<DTASOF>${periodEnd}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      // Criar e baixar o arquivo
      const fileName = startDate && endDate
        ? `extrato_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.ofx`
        : `${selectedFile.name.replace('.pdf', '')}.ofx`;

      const blob = new Blob([ofxContent], { type: 'text/ofx' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setConversionStatus(`Arquivo convertido com sucesso! ${transactions.length} transações encontradas.`);
      setStatusType('success');
    } catch (error) {
      console.error('Erro na conversão:', error);
      setConversionStatus(`Erro ao processar o arquivo: ${error.message || 'Erro desconhecido'}`);
      setStatusType('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setSelectedFile(file);
        setConversionStatus('');
        setStatusType('');
      } else {
        setSelectedFile(null);
        setConversionStatus('Por favor, selecione um arquivo PDF válido.');
        setStatusType('error');
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 bg-blue-600 text-white">
          <h1 className="text-2xl font-bold text-center">Conversor de Extrato PDF para OFX</h1>
          <p className="text-center text-blue-100 mt-2">Transforme extratos bancários em PDF para o formato OFX</p>
        </div>
        
        <div className="p-6">
          {/* Abas */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`py-2 px-4 border-b-2 ${activeTab === 'full' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
              onClick={() => setActiveTab('full')}
            >
              Extrato Completo
            </button>
            <button
              className={`py-2 px-4 border-b-2 ${activeTab === 'date' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
              onClick={() => setActiveTab('date')}
            >
              Selecionar Datas
            </button>
			{extractedTransactions.length > 0 && (
  <button 
    className="mt-3 w-full py-2 px-4 rounded-md flex items-center justify-center bg-green-600 hover:bg-green-700 text-white"
    onClick={() => setShowTransactionViewer(true)}
  >
    <Eye className="mr-2 h-5 w-5" />
    Visualizar Transações ({extractedTransactions.length})
  </button>
)}

{showTransactionViewer && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="w-full max-w-4xl">
      <TransactionViewer 
        transactions={extractedTransactions} 
        onClose={() => setShowTransactionViewer(false)} 
      />
    </div>
  </div>
)}
          </div>

          {/* Conteúdo da aba Extrato Completo */}
          {activeTab === 'full' && (
            <div className="space-y-4">
              <div 
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 gap-4 transition-colors duration-200 ease-in-out hover:border-blue-400"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <FileUp size={48} className="text-gray-400" />
                <div className="text-center">
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <span className="text-blue-500 hover:text-blue-700 font-medium">
                      Clique para selecionar o arquivo
                    </span>
                    <span className="text-gray-500 block mt-1">ou arraste e solte aqui</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">Suporta arquivos PDF de extratos bancários</p>
                </div>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          )}

          {/* Conteúdo da aba Selecionar Datas */}
          {activeTab === 'date' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">Data Inicial</label>
                  <input
                    id="start-date"
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">Data Final</label>
                  <input
                    id="end-date"
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div 
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 gap-4 transition-colors duration-200 ease-in-out hover:border-blue-400"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <FileUp size={48} className="text-gray-400" />
                <div className="text-center">
                  <label htmlFor="pdf-upload-date" className="cursor-pointer">
                    <span className="text-blue-500 hover:text-blue-700 font-medium">
                      Clique para selecionar o arquivo
                    </span>
                    <span className="text-gray-500 block mt-1">ou arraste e solte aqui</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">Apenas transações entre as datas selecionadas serão convertidas</p>
                </div>
                <input
                  id="pdf-upload-date"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          )}

          <div className="mt-6">
            {selectedFile && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-700 flex items-center">
                  <FileUp className="mr-2 h-5 w-5" />
                  Arquivo selecionado: <span className="font-medium ml-1">{selectedFile.name}</span>
                </p>
              </div>
            )}
            
            {conversionStatus && (
              <div className={`mb-4 p-4 rounded-md flex items-start ${
                statusType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
                statusType === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                'bg-blue-50 border-blue-200 text-blue-700'
              } border`}>
                {statusType === 'success' && <CheckCircle className="mr-2 h-5 w-5 flex-shrink-0 mt-0.5" />}
                {statusType === 'error' && <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0 mt-0.5" />}
                {statusType === 'info' && <Loader2 className="mr-2 h-5 w-5 flex-shrink-0 animate-spin mt-0.5" />}
                <p>{conversionStatus}</p>
              </div>
            )}

            <button 
              className={`w-full py-3 px-4 rounded-md flex items-center justify-center transition-colors duration-200 ${
                !selectedFile || isProcessing ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              onClick={handleConversion}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Converter para OFX
                </>
              )}
            </button>

            <div className="mt-4 text-xs text-gray-500 text-center">
              <p>Este conversor extrai transações bancárias de PDFs e gera um arquivo OFX compatível com a maioria dos softwares financeiros.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}