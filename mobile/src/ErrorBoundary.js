import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

// Last resort for a render crash: a way back to the site list instead of a closed app
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Screen crashed:', error?.message);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.lead}>This screen hit a problem. Your sites are still being monitored.</Text>
        <Pressable onPress={this.reset} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.canvas },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  lead: { marginTop: 8, marginBottom: 20, fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.inkSoft },
  button: { paddingHorizontal: 24, height: 48, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
