const firefly = require('./src/services/firefly');
firefly.fetchCompanyTransactions().then(txs => {
  let count = 0;
  let sum = 0;
  txs.forEach(tx => {
    (tx.attributes?.transactions || []).forEach(j => {
      if (j.type === 'withdrawal') {
        count++;
        sum += parseFloat(j.amount);
      }
    });
  });
  console.log(`Currently considering ${count} withdrawals with total amount: ${sum} EUR.`);
});
