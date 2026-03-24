import { View, Text,Image,ActivityIndicator } from 'react-native'
import {styles} from '../../assets/styles/auth.styles.js'
import { COLORS } from '@/constants/colors'
const SplashScreen = () => {
  return (
    <View style={styles.container}>
        <Image source={require("../../assets/images/lerm_logo.png")} style={styles.illustration}/>
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
    </View>
  )
}

export default SplashScreen