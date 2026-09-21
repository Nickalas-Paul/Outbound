import { Redirect } from 'expo-router';

/** Legacy `/explorer` bookmark → public map at `/`. */
export default function ExplorerIndexRedirect() {
  return <Redirect href="/" />;
}
