import { parsearLinea, parsearMarkdown, type Trozo } from '@/lib/markdown'

/** Renderiza los trozos de una línea. Sin HTML crudo: cada marca es un nodo. */
export function Linea({ texto }: { texto: string }) {
  return (
    <>
      {parsearLinea(texto).map((t, i) => (
        <Pieza key={i} trozo={t} />
      ))}
    </>
  )
}

function Pieza({ trozo }: { trozo: Trozo }) {
  switch (trozo.tipo) {
    case 'fuerte':
      return <strong>{trozo.valor}</strong>
    case 'enfasis':
      return <em>{trozo.valor}</em>
    case 'codigo':
      return <code>{trozo.valor}</code>
    case 'mencion':
      return <span style={{ color: 'var(--acento)' }}>{trozo.valor}</span>
    default:
      return <>{trozo.valor}</>
  }
}

export function Markdown({ fuente }: { fuente: string }) {
  const bloques = parsearMarkdown(fuente)

  return (
    <div className="descripcion">
      {bloques.map((b, i) => {
        if (b.tipo === 'p') {
          return (
            <p key={i}>
              <Linea texto={b.texto} />
            </p>
          )
        }

        const Lista = b.tipo === 'ul' ? 'ul' : 'ol'
        return (
          <Lista key={i}>
            {b.items.map((item, j) => (
              <li key={j}>
                <Linea texto={item} />
              </li>
            ))}
          </Lista>
        )
      })}
    </div>
  )
}
