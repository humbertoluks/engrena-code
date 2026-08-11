import { describe, expect, it } from 'vitest'
import { decisionBlock, detectDecisionQuestion, MAX_QUESTION_CHARS } from './decision-question.js'

describe('detectDecisionQuestion — pedido de autorização', () => {
  it('resposta que termina pedindo autorização vira sim/não', () => {
    const result = detectDecisionQuestion('Preciso rodar npm install para baixar as dependências. Posso prosseguir?')
    expect(result).toEqual({
      question: 'Posso prosseguir?',
      options: ['Sim, pode prosseguir', 'Não, aguarde'],
    })
  })

  it.each([
    'Autoriza a instalação?',
    'Quer que eu crie o servidor agora?',
    'Confirma a remoção do arquivo?',
    'Devo aplicar o diff?',
  ])('reconhece "%s"', (text) => {
    expect(detectDecisionQuestion(text)?.options).toEqual(['Sim, pode prosseguir', 'Não, aguarde'])
  })

  it.each([
    'Plan: Node + Express, single server.js. Proceed?',
    'Should I create the files now?',
    'Do you want me to install the dependencies?',
  ])('reconhece o mesmo pedido em inglês: "%s"', (text) => {
    expect(detectDecisionQuestion(text)?.options).toEqual(['Sim, pode prosseguir', 'Não, aguarde'])
  })

  it('pergunta explicitamente binária também conta', () => {
    expect(detectDecisionQuestion('Encerro aqui, sim ou não?')?.options).toHaveLength(2)
  })
})

describe('detectDecisionQuestion — alternativas enumeradas', () => {
  it('usa a lista que antecede a pergunta', () => {
    const text = [
      'Vejo três caminhos:',
      '- Criar o servidor com Express',
      '- Usar Fastify',
      '- Só gerar o package.json',
      'Qual prefere?',
    ].join('\n')

    expect(detectDecisionQuestion(text)).toEqual({
      question: 'Qual prefere?',
      options: ['Criar o servidor com Express', 'Usar Fastify', 'Só gerar o package.json'],
    })
  })

  it('aceita lista numerada e limpa marcação', () => {
    const text = ['1) **Rodar os testes**', '2) `Fazer o build`', 'Por onde começo?'].join('\n')
    expect(detectDecisionQuestion(text)?.options).toEqual(['Rodar os testes', 'Fazer o build'])
  })

  it('corta em 4 opções', () => {
    const text = ['- a1', '- a2', '- a3', '- a4', '- a5', 'Qual delas?'].join('\n')
    expect(detectDecisionQuestion(text)?.options).toHaveLength(4)
  })

  it('lista solta longe da pergunta não vira menu', () => {
    const text = ['- item antigo', '', 'Segue um texto explicativo qualquer.', 'Qual caminho você prefere?'].join('\n')
    expect(detectDecisionQuestion(text)).toBeNull()
  })

  it('lista de um item só não vira menu', () => {
    expect(detectDecisionQuestion(['- único', 'Qual prefere?'].join('\n'))).toBeNull()
  })
})

describe('detectDecisionQuestion — o que não vira decisão', () => {
  it('resposta sem pergunta no fim', () => {
    expect(detectDecisionQuestion('Servidor criado em server.js.')).toBeNull()
  })

  it('pergunta no meio, com explicação depois', () => {
    expect(detectDecisionQuestion('Posso prosseguir? Vou começar pelo package.json e depois o server.')).toBeNull()
  })

  it('pergunta aberta sem alternativa', () => {
    expect(detectDecisionQuestion('O que você acha do resultado?')).toBeNull()
  })

  it('pergunta longa demais', () => {
    expect(detectDecisionQuestion(`${'a'.repeat(MAX_QUESTION_CHARS + 1)}?`)).toBeNull()
  })

  it('texto vazio', () => {
    expect(detectDecisionQuestion('   ')).toBeNull()
  })

  it('isola a pergunta da frase anterior na mesma linha', () => {
    expect(detectDecisionQuestion('Tudo pronto. Posso rodar o build?')?.question).toBe('Posso rodar o build?')
  })
})

describe('decisionBlock', () => {
  it('empacota como bloco da mensagem', () => {
    expect(decisionBlock({ question: 'Posso?', options: ['Sim, pode prosseguir', 'Não, aguarde'] })).toEqual({
      type: 'decision',
      question: 'Posso?',
      options: ['Sim, pode prosseguir', 'Não, aguarde'],
    })
  })
})
