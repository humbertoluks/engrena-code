// Identidade própria da mensagem do usuário, gerada no renderer antes do POST.
// A bolha otimista do chat precisa ser casada com a mensagem persistida; casar por conteúdo
// quebra porque o servidor reescreve o prompt antes de gravar (modo de chat, anexos de contexto,
// expansão de slash) e duas mensagens iguais limpam a bolha errada.
// Sem índice: ninguém consulta por client_id no servidor — a reconciliação é em memória, no renderer.
export const id = '019_message_client_id'

export const sql = `
ALTER TABLE messages ADD COLUMN client_id TEXT;
`
