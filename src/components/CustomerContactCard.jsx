import {MessageCircle,Phone} from 'lucide-react'
import {formatCpf} from '../utils/buyerSearch'
import {customerWhatsapp,customerPhoneLabel} from '../utils/customerContact'
import './CustomerContactCard.css'
export default function CustomerContactCard({buyer,eventTitle='',detail=''}){
 const contact=customerWhatsapp(buyer,eventTitle)
 return <article className="customer-contact-card" aria-label={'Cliente '+(buyer.name||'Sem nome')}><div className="customer-contact-info"><h3>{buyer.name||'Nome não informado'}</h3><dl><div><dt>CPF</dt><dd>{formatCpf(buyer.cpf)}</dd></div><div><dt>E-mail</dt><dd>{buyer.email||'Não informado'}</dd></div></dl>{detail&&<p className="customer-contact-detail">{detail}</p>}</div><div className="customer-contact-actions"><p className="customer-contact-phone"><Phone size={17} aria-hidden="true"/><span>{customerPhoneLabel(buyer)}</span></p>{contact?<a className="customer-whatsapp-button" href={contact.url} target="_blank" rel="noopener noreferrer" aria-label={'Falar no WhatsApp com '+(buyer.name||'cliente')}><MessageCircle size={20} aria-hidden="true"/>Falar no WhatsApp</a>:<><button className="customer-whatsapp-button" type="button" disabled><MessageCircle size={20} aria-hidden="true"/>WhatsApp indisponível</button><small>{buyer.phone?'Confira o número cadastrado, com DDD.':'Cliente sem telefone cadastrado.'}</small></>}</div></article>
}
