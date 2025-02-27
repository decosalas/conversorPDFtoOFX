// components/TransactionViewer.js
import React from 'react';

export default function TransactionViewer({ transactions, onClose }) {
  // Agrupar transações por data
  const groupedTransactions = transactions.reduce((acc, transaction) => {
    const date = transaction.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {});
  
  // Formatar data YYYYMMDD para DD/MM/YYYY
  const formatDate = (dateStr) => {
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
  };

  // Formatar valor em reais
  const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    return numValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Obter cor de acordo com o tipo de transação
  const getTransactionTypeColor = (type) => {
    const typeColors = {
      'PIX': 'bg-blue-100 text-blue-800',
      'XFER': 'bg-purple-100 text-purple-800',
      'DEP': 'bg-green-100 text-green-800',
      'DEBIT': 'bg-red-100 text-red-800',
      'PAYMENT': 'bg-orange-100 text-orange-800',
      'INT': 'bg-cyan-100 text-cyan-800',
      'FEE': 'bg-rose-100 text-rose-800',
      'ATM': 'bg-amber-100 text-amber-800',
      'OTHER': 'bg-gray-100 text-gray-800'
    };
    
    return typeColors[type] || 'bg-gray-100 text-gray-800';
  };

  // Obter o valor total das transações
  const totalValue = transactions.reduce((sum, transaction) => sum + parseFloat(transaction.value), 0);
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-h-[80vh] flex flex-col">
      <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
        <h3 className="text-lg font-semibold">Transações Extraídas</h3>
        <button onClick={onClose} className="text-white hover:text-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4 bg-blue-50">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Total de transações: <span className="font-medium text-gray-900">{transactions.length}</span></p>
            <p className="text-sm text-gray-600">Período: <span className="font-medium text-gray-900">
              {transactions.length > 0 ? 
                `${formatDate(transactions[0].date)} - ${formatDate(transactions[transactions.length-1].date)}` : 
                'N/A'}
            </span></p>
          </div>
          <div className={`text-lg font-bold ${totalValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Saldo: {formatCurrency(totalValue)}
          </div>
        </div>
      </div>
      
      <div className="overflow-y-auto p-4">
        {Object.keys(groupedTransactions).sort().map(date => (
          <div key={date} className="mb-4">
            <h4 className="text-sm font-medium bg-gray-100 p-2 rounded-t-md sticky top-0">
              {formatDate(date)}
            </h4>
            <div className="space-y-2">
              {groupedTransactions[date].map((transaction, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${getTransactionTypeColor(transaction.type)}`}>
                        {transaction.type}
                      </span>
                      <span className="ml-2 text-sm font-medium text-gray-900 truncate max-w-xs">
                        {transaction.memo.length > 60 ? `${transaction.memo.substring(0, 60)}...` : transaction.memo}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${parseFloat(transaction.value) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(transaction.value)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {transaction.fitid}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}