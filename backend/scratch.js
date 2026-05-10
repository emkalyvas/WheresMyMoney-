const firefly = require('./src/services/firefly');
firefly.fetchCompanyTransactions().then(txs => {
  const sum = txs.reduce((acc, tx) => {
    return acc + tx.attributes.transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount), 0);
  }, 0);
  console.log('Total withdrawal amount in raw txs (MnApps):', sum);
});
