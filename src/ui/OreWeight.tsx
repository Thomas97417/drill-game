// Badge de poids d'un minerai : autant de « caisses » que d'emplacements de
// soute occupés par unité (TileDef.size). Plus lisible d'un coup d'œil que le
// nombre brut, et cohérent avec le compteur de soute du HUD.
export function OreWeight({ size = 1 }: { size?: number }) {
  return (
    <span
      className="ore-weight"
      title={`Encombrement : ${size} emplacement${size > 1 ? "s" : ""} de soute par unité`}
    >
      {Array.from({ length: size }, (_, i) => (
        <i key={i} className="ore-weight-pip" />
      ))}
    </span>
  );
}
