# Connecting Google Drive to Documentation (one time, about 15 minutes)

Documentation uploads go into the PHILRADS Documentation folder in Google Drive:
<https://drive.google.com/drive/folders/1gXtyek05YP_57rsPYzRIUcqpCCg1N-_l>

The portal uploads as the **PHILRADS Google account** (`info.philrads@gmail.com`). Files are filed as
`Documentation › uploader's name › category` (for example `Documentation › Maria Santos › Photos`).
Uploaded files count against the PHILRADS account's 15 GB of Google storage.

There are four parts. Do them in order.

---

## Part A: the folder's owner shares the folder (2 minutes)

The person who owns the Documentation folder does this, on their own Google account. (If `info.philrads@gmail.com` already owns the folder, skip Part A.)

1. Open the folder link above.
2. Click the folder name at the top → **Share**.
3. In "Add people", type `info.philrads@gmail.com`.
4. On the right, change **Viewer** to **Editor**.
5. Click **Send**.

---

## Part B: create the "Connect Google Drive" permission in Google Cloud (10 minutes)

Do this signed in as **info.philrads@gmail.com**.

1. Go to <https://console.cloud.google.com>. Accept the terms if asked.
2. At the top left, click the project picker (it may say "Select a project") → **New project**.
   Name it `PHILRADS Portal` → **Create**. Wait a few seconds, then select it in the project picker.
3. Turn on Google Drive for the project:
   - In the search bar at the top, type **Google Drive API** and open it.
   - Click **Enable**.
4. Set up the sign-in screen:
   - In the search bar, type **Google Auth Platform** (or "OAuth consent screen") and open it → **Get started**.
   - App name: `PHILRADS Staff Portal`. User support email: `info.philrads@gmail.com` → **Next**.
   - Audience: **External** → **Next**.
   - Contact email: `info.philrads@gmail.com` → **Next**. Tick the agreement → **Continue** → **Create**.
5. Allow Drive access:
   - In the left menu, click **Data access** → **Add or remove scopes**.
   - In the filter box, type `auth/drive`, tick the row that says **`.../auth/drive`**
     ("See, edit, create and delete all of your Google Drive files"). Also tick **openid** and **email**
     (`.../auth/userinfo.email`).
   - Click **Update**, then **Save** at the bottom.
6. Make it last (important: otherwise the connection stops after 7 days):
   - In the left menu, click **Audience** → under "Publishing status", click **Publish app** → **Confirm**.
     It should now say **In production**.
7. Create the portal's key:
   - In the left menu, click **Clients** → **Create client**.
   - Application type: **Web application**. Name: `PHILRADS Portal`.
   - Under **Authorised redirect URIs**, click **Add URI** and paste exactly:
     `https://philrads-portal.vercel.app/api/drive/callback`
   - Click **Create**. A box shows a **Client ID** and a **Client secret**. Keep this box open for Part C.
     (You can see them again later under Clients → PHILRADS Portal.)

---

## Part C: give the key to the portal in Vercel (3 minutes)

1. Go to <https://vercel.com> → open the **philrads-portal** project → **Settings** → **Environment Variables**.
2. Add the first one:
   - Key: `GOOGLE_CLIENT_ID`
   - Value: paste the **Client ID** from Part B (ends in `.apps.googleusercontent.com`)
   - Environments: Production (and Preview, if you like) → **Save**.
3. Add the second one:
   - Key: `GOOGLE_CLIENT_SECRET`
   - Value: paste the **Client secret** from Part B (starts with `GOCSPX-`)
   - Environments: same as above → **Save**. You can mark it **Sensitive**.
4. Tell Claude "saved": the portal needs one redeploy to pick these up.

Never paste these into the portal itself, a chat, or a `VITE_` variable.

---

## Part D: connect (1 minute)

1. Sign in to the portal as an administrator → **Documentation**.
2. In the Google Drive box, the folder link is already filled in → **Connect Google Drive**.
3. Google asks you to choose an account: pick **info.philrads@gmail.com**.
4. Google may say **"Google hasn't verified this app"**. That's expected (the app is only for PHILRADS):
   click **Advanced** → **Go to PHILRADS Staff Portal (unsafe)**.
5. Tick **every** box Google shows (especially the Google Drive one) → **Continue**.
6. You're back in the portal, which says **"Google Drive is connected"**. Everyone can upload now.

### If something goes wrong

| The portal says | What to do |
| --- | --- |
| "info.philrads@gmail.com can't open that folder" | Part A wasn't done, or was shared with another address. |
| "…can only view…" | In Part A, the access was left as Viewer: change it to Editor. |
| "Drive access wasn't allowed" | Connect again and tick the Google Drive box in step 5. |
| "Google sign-in isn't set up on the server yet" | Part C is missing, or the portal hasn't been redeployed since. |
| "Uploads are paused" (later) | Someone removed the access or the PHILRADS password changed: connect again (Part D). |
| "The connected Google Drive is full" | Free up space in the PHILRADS account or buy Google One storage. |
