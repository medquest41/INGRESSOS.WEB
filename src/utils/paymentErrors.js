export function paymentErrorMessage(message){
 const text=String(message||'')
 if(/date_of_expiration|valid date and format|expiration.date/i.test(text))return 'Não foi possível gerar o Pix porque o prazo foi recusado pelo provedor. Volte ao pedido e tente novamente. Se já pagou, não pague de novo.'
 return text||'Não foi possível consultar o pagamento. Tente novamente.'
}
