import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getEmergencyContactSlotLabel } from '@/lib/emergency-contacts';
import { useRouter } from 'expo-router';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value?.trim() ? value : 'Not provided'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, loading } = useUserProfile();

  if (loading || !user) return null;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your ElderEase information is saved per account.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Info</Text>
        <InfoRow label="Name" value={profile?.displayName || user.displayName || ''} />
        <InfoRow label="Email" value={profile?.email || user.email || ''} />
        <InfoRow label="Phone Number" value={profile?.phoneNumber || ''} />
        <InfoRow label="Age" value={profile?.age} />
        <InfoRow label="Blood Group" value={profile?.bloodGroup} />
        <InfoRow label="Allergies" value={profile?.allergies} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medicines</Text>
        {profile?.medicines?.length ? (
          profile.medicines.map((medicine) => (
            <View key={medicine.id} style={styles.card}>
              <Text style={styles.cardTitle}>{medicine.name}</Text>
              <Text style={styles.cardText}>{medicine.dosage} • {medicine.frequency}</Text>
              {medicine.time ? <Text style={styles.cardText}>Time: {medicine.time}</Text> : null}
              {medicine.notes ? <Text style={styles.cardText}>Notes: {medicine.notes}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No medicines added yet.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        {profile?.emergencyContacts?.length ? (
          profile.emergencyContacts.map((contact) => (
            <View key={contact.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{contact.name}</Text>
                  <Text style={styles.cardText}>{getEmergencyContactSlotLabel(contact.slot)}</Text>
                </View>
                {contact.isPrimary ? <Text style={styles.primaryTag}>Primary</Text> : null}
              </View>
              <Text style={styles.cardText}>{contact.relation}</Text>
              <Text style={styles.cardText}>{contact.phone}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No contacts added yet.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/profile/edit')} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={signOut} activeOpacity={0.85}>
        <Text style={styles.secondaryButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.background,
    minHeight: '100%',
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.inputBg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  cardText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  primaryTag: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    ...Shadows.strong,
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  secondaryButton: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
});
