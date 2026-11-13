# Kuber Gold Loan (React Native / Expo)
Offline-first gold loan manager. Data is stored on the device (AsyncStorage: on-device on Android, localStorage in Chrome).

## Run
    npm install
    npx expo install --fix     # aligns package versions with your Expo SDK
    npx expo start --web       # Chrome
    npx expo start --android   # Android emulator / phone via Expo Go

## Build a personal APK
    npm i -g eas-cli && eas build -p android --profile preview
