import { COLORS } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { styles } from '../../assets/styles/auth.styles.js'

const SignIn = () => {
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState("");

  // Database selection state
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [fetchingDbs, setFetchingDbs] = useState(false);
  const [dbFetched, setDbFetched] = useState(false);
  const [dbModalVisible, setDbModalVisible] = useState(false);

  const getLocalIp = () => {
    try {
      const hostUri = Constants?.expoConfig?.hostUri;
      if (hostUri) {
        return hostUri.split(':')[0];
      }
    } catch (e) {
      console.warn('Could not get hostUri from Constants');
    }
    return '10.0.2.2'; // Fallback
  };

  const fetchDatabases = async (url) => {
    let trimmedUrl = (url || serverUrl).trim();
    if (!trimmedUrl) return;

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `http://${trimmedUrl}`;
    }
    trimmedUrl = trimmedUrl.replace(/\/+$/, "");

    setFetchingDbs(true);
    setDatabases([]);
    setSelectedDb("");
    setDbFetched(false);

    const fullUrl = `${trimmedUrl}/web/database/list`;
    console.log("Fetching DBs from:", fullUrl);
    try {
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ jsonrpc: "2.0", params: {} }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'no text');
        console.warn("fetchDatabases error details:", fullUrl, response.status, errorText);
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // Odoo's built-in endpoint returns an array directly in data.result
      const dbList = Array.isArray(data.result) ? data.result : (data.result?.databases || []);

      setDatabases(dbList);
      setDbFetched(true);

      if (dbList.length === 1) {
        setSelectedDb(dbList[0]);
      }
    } catch (err) {
      console.warn("Could not fetch databases:", err.message);
      setDatabases([]);
      setDbFetched(true);
    } finally {
      setFetchingDbs(false);
    }
  };

  const onSignInPress = async () => {
    if (!serverUrl || !emailAddress || !password) {
      setError("Please fill in all fields");
      return;
    }

    let formattedUrl = serverUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `http://${formattedUrl}`;
    }
    formattedUrl = formattedUrl.replace(/\/+$/, "");

    if (databases.length > 1 && !selectedDb) {
      setError("Please select a database");
      return;
    }

    try {
      // Use Odoo's built-in /web/session/authenticate (server-wide, works on all versions)
      const dbToUse = selectedDb || (databases.length === 1 ? databases[0] : "");
      const request_body = {
        db: dbToUse,
        login: emailAddress.trim(),
        password: password,
      };

      const response = await fetch(`${formattedUrl}/web/session/authenticate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
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
      console.log("Login Response:", JSON.stringify(data));

      // Check for JSON-RPC error (e.g. AccessDenied)
      if (data.error) {
        const errMsg = data.error.data?.message || data.error.message || "Invalid credentials";
        setError(errMsg);
        Alert.alert("Login Failed", errMsg);
        return;
      }

      const result = data.result;
      const uid = result.uid;
      // Extract session_id from Set-Cookie header (Odoo 17+) or from JSON body (older Odoo)
      let sessionId = result.session_id || "";
      if (!sessionId) {
        const setCookie = response.headers.get("set-cookie") || "";
        const match = setCookie.match(/session_id=([^;]+)/);
        if (match) {
          sessionId = match[1];
        }
      }
      console.log("Extracted session_id:", sessionId);

      if (uid) {
        console.log("Storing credentials:", { email: emailAddress, uid });
        await SecureStore.setItemAsync("email", emailAddress.trim());
        await SecureStore.setItemAsync("password", password);
        await SecureStore.setItemAsync("server_url", formattedUrl);
        await SecureStore.setItemAsync("uid", String(uid));
        await SecureStore.setItemAsync("session_id", sessionId);
        if (dbToUse) {
          await SecureStore.setItemAsync("database", dbToUse);
        }
        console.log("Setting session id", sessionId);
        setError("");
        router.replace("/");
      } else {
        setError("Invalid credentials");
        Alert.alert("Login Failed", "Invalid credentials");
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

        {/* Server URL */}
        <TextInput
          style={[styles.input, error && styles.errorInput]}
          autoCapitalize="none"
          placeholder="Enter Server URL"
          placeholderTextColor="#9A8478"
          onChangeText={(text) => {
            let newVal = text.trim();
            if (newVal.toLowerCase().includes('localhost')) {
              const ip = getLocalIp();
              if (ip) {
                newVal = newVal.replace(/localhost/gi, ip);
              }
            }
            setServerUrl(newVal);
            // Reset DB state when URL changes
            setDatabases([]);
            setSelectedDb("");
            setDbFetched(false);
          }}
          onBlur={() => fetchDatabases()}
          value={serverUrl}
        />

        {/* Database loading indicator */}
        {fetchingDbs ? (
          <View style={styles.dbLoadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.dbLoadingText}>Fetching databases...</Text>
          </View>
        ) : null}

        {/* Database picker */}
        <>
          <TouchableOpacity
            style={styles.dbPickerButton}
            onPress={() => setDbModalVisible(true)}
          >
            <Ionicons name="server-outline" size={20} color={COLORS.primary} />
            <Text
              style={[
                styles.dbPickerText,
                !selectedDb && styles.dbPickerPlaceholder,
              ]}
            >
              {selectedDb || "Select Database"}
            </Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Database selection modal */}
          <Modal
            visible={dbModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDbModalVisible(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setDbModalVisible(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Database</Text>
                {databases.map((db) => (
                  <TouchableOpacity
                    key={db}
                    style={[
                      styles.modalOption,
                      selectedDb === db && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedDb(db);
                      setDbModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name={selectedDb === db ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={selectedDb === db ? COLORS.primary : COLORS.textLight}
                    />
                    <Text
                      style={[
                        styles.modalOptionText,
                        selectedDb === db && styles.modalOptionTextSelected,
                      ]}
                    >
                      {db}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Modal>
        </>

        {/* Email */}
        <TextInput
          style={[styles.input, error && styles.errorInput]}
          autoCapitalize="none"
          placeholder="Enter email"
          placeholderTextColor="#9A8478"
          onChangeText={(text) => setEmailAddress(text.trim())}
          value={emailAddress}
        />

        {/* Password */}
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