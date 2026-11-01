import { Redirect } from 'expo-router';

export default function AdminLoginCompatibilityRoute() {
  return <Redirect href={{ pathname: '/login', params: { redirect: '/admin' } }} />;
}
