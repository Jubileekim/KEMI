export function Brand({ symbol = false }: { symbol?: boolean }) {
  return (
    <img
      src={`/brand/svg/${symbol ? 'symbol' : 'logo'}-primary.svg`}
      alt={symbol ? 'KEMI 심볼' : 'KEMI'}
      width={symbol ? 44 : 156}
      className="h-auto shrink-0"
    />
  );
}
