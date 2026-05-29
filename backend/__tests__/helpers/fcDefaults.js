// Parametros default do fast-check para testes PBT de race conditions.
// 25 runs * ~5 requests HTTP = ~125 interacoes DB — suficiente para
// encontrar races recorrentes sem inflar CI. Aumente numRuns localmente
// se estiver caracterizando flakiness.
module.exports = {
    numRuns: 25,
    verbose: true,
    endOnFailure: true,
    timeout: 20000,
};
