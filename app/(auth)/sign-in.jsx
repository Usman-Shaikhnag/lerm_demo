import { COLORS } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useState } from 'react'
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { styles } from '../../assets/styles/auth.styles.js'



const SignIn = () => {
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState("");

  const onSignInPress = async () => {
    if (!serverUrl || !emailAddress || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const request_body = {
        email: emailAddress,
        password: password,
      };

      const response = await fetch(`${serverUrl}/mobile_login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          params: request_body,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Login Response:", data);

      if (data.result.success) {
        console.log("Storing credentials:", { email: emailAddress, uid: data.result.uid });
        await SecureStore.setItemAsync("email", emailAddress);
        await SecureStore.setItemAsync("password", password); // Store password securely
        await SecureStore.setItemAsync("server_url", serverUrl);
        await SecureStore.setItemAsync("uid", String(data.result.uid));
        await SecureStore.setItemAsync("session_id", String(data.result.session_id));
        console.log("Setting session id", String(data.result.session_id))
        setError("");
        router.replace("/");
      } else {
        setError(data.result.error || "Invalid credentials");
        Alert.alert("Login Failed", data.result.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login Error:", error);
      setError(error.message || "An error occurred during login");
      Alert.alert("Error", error.message || "An error occurred during login");
    }
  };
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
    >
      <View style={styles.container}>
        <Image
          source={require("../../assets/images/lerm_logo.png")}
          style={styles.illustration}
        />
        <Text style={styles.title}>Sign in</Text>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.expense} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")}>
              <Ionicons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, error && styles.errorInput]}
          autoCapitalize="none"
          placeholder="Enter Server URL"
          placeholderTextColor="#9A8478"
          onChangeText={(text) => setServerUrl(text.trim())}
          value={serverUrl}
        />
        <TextInput
          style={[styles.input, error && styles.errorInput]}
          autoCapitalize="none"
          placeholder="Enter email"
          placeholderTextColor="#9A8478"
          onChangeText={setEmailAddress}
          value={emailAddress}
        />
        <TextInput
          style={[styles.input, error && styles.errorInput]}
          placeholder="Enter password"
          secureTextEntry={true}
          placeholderTextColor="#9A8478"
          onChangeText={setPassword}
          value={password}
        />
        <TouchableOpacity style={styles.button} onPress={onSignInPress}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
};

export default SignIn;