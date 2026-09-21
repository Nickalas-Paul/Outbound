/**
 * Native: no Turnstile widget.
 * TODO: native Turnstile via WebView if mobile app goes public
 */
export default function TurnstileWidget(_props: {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
}) {
  return null;
}
