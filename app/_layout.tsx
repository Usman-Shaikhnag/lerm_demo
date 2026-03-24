import { Stack,Redirect } from "expo-router";
import SafeScreen from '../components/SafeScreen'
export default function RootLayout() {
  return <SafeScreen>

        <Stack screenOptions={{headerShown:false,navigationBarHidden:true}}/>

      </SafeScreen>
}
