import { COLORS } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
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

  const fetchDatabases = async (url) => {
    const trimmedUrl = (url || serverUrl).trim();
    if (!trimmedUrl) return;

    setFetchingDbs(true);
    setDatabases([]);
    setSelectedDb("");
    setDbFetched(false);

    try {
      const response = await fetch(`${trimmedUrl}/mobile/db_list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ jsonrpc: "2.0", params: {} }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const dbList = data.result?.databases || [];

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

    if (databases.length > 1 && !selectedDb) {
      setError("Please select a database");
      return;
    }

    try {
      const request_body = {
        email: emailAddress.trim(),
        password: password,
        ...(selectedDb ? { db: selectedDb } : {}),
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
        await SecureStore.setItemAsync("email", emailAddress.trim());
        await SecureStore.setItemAsync("password", password);
        await SecureStore.setItemAsync("server_url", serverUrl);
        await SecureStore.setItemAsync("uid", String(data.result.uid));
        await SecureStore.setItemAsync("session_id", String(data.result.session_id));
        if (selectedDb) {
          await SecureStore.setItemAsync("database", selectedDb);
        }
        console.log("Setting session id", String(data.result.session_id));
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

  const showMultipleDbs = databases.length > 1;

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
            setServerUrl(text.trim());
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

        {/* Database picker — only shown when multiple databases exist */}
        {showMultipleDbs ? (
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
        ) : null}

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