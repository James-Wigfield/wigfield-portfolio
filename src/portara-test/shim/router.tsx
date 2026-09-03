/**
 * PORTARA-TEST shim for react-router's <Link>.
 *
 * The landing page links to /login, /signup, /privacy and /terms. Those routes
 * exist on portara.com.au, not in the portfolio, so a real <Link> would land
 * on a blank page here. Same props, same markup - just an absolute href.
 * When porting back, home.tsx imports Link from "react-router" again.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

export const PORTARA_ORIGIN = "https://portara.com.au";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  children?: ReactNode;
};

export function Link({ to, children, ...rest }: Props) {
  return (
    <a href={`${PORTARA_ORIGIN}${to}`} {...rest}>
      {children}
    </a>
  );
}
