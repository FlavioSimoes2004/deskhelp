/** Marca do DeskHelp: um canhoto de chamado na cor de destaque, com um "+" branco. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        style={{ fill: "var(--petrol)" }}
        d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z"
      />
      <path
        fill="none"
        style={{ stroke: "var(--on-petrol)" }}
        strokeWidth="2.4"
        strokeLinecap="round"
        d="M11 16h10M16 11v10"
      />
    </svg>
  );
}
