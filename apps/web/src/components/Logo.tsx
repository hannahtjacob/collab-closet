type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="intracloset-tall-arch">
          <path d="M8 96V37a27 27 0 0 1 54 0v59Z" />
        </clipPath>
      </defs>
      <path d="M8 96V37a27 27 0 0 1 54 0v59Z" fill="var(--coral)" />
      <path d="M40 96V76a28 28 0 0 1 56 0v20Z" fill="var(--green)" />
      <path d="M40 96V76a28 28 0 0 1 56 0v20Z" fill="var(--ink)" clipPath="url(#intracloset-tall-arch)" />
    </svg>
  );
}
