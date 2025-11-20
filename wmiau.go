package main

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/jmoiron/sqlx"
	"github.com/mdp/qrterminal/v3"
	"github.com/patrickmn/go-cache"
	"github.com/rs/zerolog/log"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

// db field declaration as *sqlx.DB
type MyClient struct {
	WAClient       *whatsmeow.Client
	eventHandlerID uint32
	userID         string
	token          string
	subscriptions  []string
	db             *sqlx.DB
}

// addSessionInfo adds the connected session information to the postmap
func (mycli *MyClient) addSessionInfo(postmap map[string]interface{}) {
	if mycli.WAClient.Store.ID != nil {
		sessionInfo := map[string]interface{}{
			"jid":    mycli.WAClient.Store.ID.String(),
			"userID": mycli.userID,
			"token":  mycli.token,
			"lid":    mycli.WAClient.Store.LID,
		}

		// Add device info if available
		if mycli.WAClient.Store.ID.Device != 0 {
			sessionInfo["device"] = mycli.WAClient.Store.ID.Device
		}

		// Add server info
		sessionInfo["server"] = mycli.WAClient.Store.ID.Server

		// Add pushname if available
		if mycli.WAClient.Store.PushName != "" {
			sessionInfo["pushName"] = mycli.WAClient.Store.PushName
		}

		postmap["Session"] = sessionInfo
	}
}

func sendToGlobalWebHook(jsonData []byte, token string, userID string) {
	jsonDataStr := string(jsonData)

	instance_name := ""
	userinfo, found := userinfocache.Get(token)
	if found {
		instance_name = userinfo.(Values).Get("Name")
	}

	if *globalWebhook != "" {
		log.Info().Str("url", *globalWebhook).Msg("Calling global webhook")
		// Add extra information for the global webhook
		globalData := map[string]string{
			"jsonData":     jsonDataStr,
			"token":        token,
			"userID":       userID,
			"instanceName": instance_name,
		}
		callHook(*globalWebhook, globalData, userID)
	}
}

func sendToUserWebHook(webhookurl string, path string, jsonData []byte, userID string, token string) {

	instance_name := ""
	userinfo, found := userinfocache.Get(token)
	if found {
		instance_name = userinfo.(Values).Get("Name")
	}
	data := map[string]string{
		"jsonData":     string(jsonData),
		"token":        token,
		"instanceName": instance_name,
	}

	log.Debug().Interface("webhookData", data).Msg("Data being sent to webhook")

	if webhookurl != "" {
		log.Info().Str("url", webhookurl).Msg("Calling user webhook")
		if path == "" {
			go callHook(webhookurl, data, userID)
		} else {
			// Create a channel to capture the error from the goroutine
			errChan := make(chan error, 1)
			go func() {
				err := callHookFile(webhookurl, data, userID, path)
				errChan <- err
			}()

			// Optionally handle the error from the channel (if needed)
			if err := <-errChan; err != nil {
				log.Error().Err(err).Msg("Error calling hook file")
			}
		}
	} else {
		log.Warn().Str("userid", userID).Msg("No webhook set for user")
	}
}

func updateAndGetUserSubscriptions(mycli *MyClient) ([]string, error) {
	// Get updated events from cache/database
	currentEvents := ""
	userinfo2, found2 := userinfocache.Get(mycli.token)
	if found2 {
		currentEvents = userinfo2.(Values).Get("Events")
	} else {
		// If not in cache, get from database
		if err := mycli.db.Get(&currentEvents, "SELECT events FROM users WHERE id=$1", mycli.userID); err != nil {
			log.Warn().Err(err).Str("userID", mycli.userID).Msg("Could not get events from DB")
			return nil, err // Propagate the error
		}
	}

	// Update client subscriptions if changed
	eventarray := strings.Split(currentEvents, ",")
	var subscribedEvents []string
	if len(eventarray) == 1 && eventarray[0] == "" {
		subscribedEvents = []string{}
	} else {
		for _, arg := range eventarray {
			arg = strings.TrimSpace(arg)
			if arg != "" && Find(supportedEventTypes, arg) {
				subscribedEvents = append(subscribedEvents, arg)
			}
		}
	}

	// Update the client subscriptions
	mycli.subscriptions = subscribedEvents

	return subscribedEvents, nil
}

func getUserWebhookUrl(token string) string {
	webhookurl := ""
	myuserinfo, found := userinfocache.Get(token)
	if !found {
		log.Warn().Str("token", token).Msg("Could not call webhook as there is no user for this token")
	} else {
		webhookurl = myuserinfo.(Values).Get("Webhook")
	}
	return webhookurl
}

func sendEventWithWebHook(mycli *MyClient, postmap map[string]interface{}, path string) {
	webhookurl := getUserWebhookUrl(mycli.token)

	// Get updated events from cache/database
	subscribedEvents, err := updateAndGetUserSubscriptions(mycli)
	if err != nil {
		return
	}

	eventType, ok := postmap["type"].(string)
	if !ok {
		log.Error().Msg("Event type is not a string in postmap")
		return
	}

	// Log subscription details for debugging
	log.Debug().
		Str("userID", mycli.userID).
		Str("eventType", eventType).
		Strs("subscribedEvents", subscribedEvents).
		Msg("Checking event subscription")

	// Check if the current event is in the subscriptions
	checkIfSubscribedInEvent := checkIfSubscribedToEvent(subscribedEvents, postmap["type"].(string), mycli.userID)
	if !checkIfSubscribedInEvent {
		return
	}

	// Prepare webhook data
	jsonData, err := json.Marshal(postmap)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal postmap to JSON")
		return
	}

	// Call user webhook if configured
	sendToUserWebHook(webhookurl, path, jsonData, mycli.userID, mycli.token)

	// Get global webhook if configured
	go sendToGlobalWebHook(jsonData, mycli.token, mycli.userID)

	go sendToGlobalRabbit(jsonData)
}

// processMessageAsync processes the entire message asynchronously
// This prevents blocking the main event handler during message processing
func (mycli *MyClient) processMessageAsync(evt *events.Message) {
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Str("messageID", evt.Info.ID).Msg("Recovered from panic in async message processing")
		}
	}()

	txtid := mycli.userID
	postmap := make(map[string]interface{})
	postmap["event"] = evt
	postmap["type"] = "Message"

	var s3Config struct {
		Enabled       string `db:"s3_enabled"`
		MediaDelivery string `db:"media_delivery"`
	}

	lastMessageCache.Set(mycli.userID, &evt.Info, cache.DefaultExpiration)
	myuserinfo, found := userinfocache.Get(mycli.token)
	if !found {
		err := mycli.db.Get(&s3Config, "SELECT CASE WHEN s3_enabled = 1 THEN 'true' ELSE 'false' END AS s3_enabled, media_delivery FROM users WHERE id = $1", txtid)
		if err != nil {
			log.Error().Err(err).Msg("onMessage Failed to get S3 config from DB as it was not on cache")
			s3Config.Enabled = "false"
			s3Config.MediaDelivery = "base64"
		}
	} else {
		s3Config.Enabled = myuserinfo.(Values).Get("S3Enabled")
		s3Config.MediaDelivery = myuserinfo.(Values).Get("MediaDelivery")
	}

	metaParts := []string{fmt.Sprintf("pushname: %s", evt.Info.PushName), fmt.Sprintf("timestamp: %s", evt.Info.Timestamp)}
	if evt.Info.Type != "" {
		metaParts = append(metaParts, fmt.Sprintf("type: %s", evt.Info.Type))
	}
	if evt.Info.Category != "" {
		metaParts = append(metaParts, fmt.Sprintf("category: %s", evt.Info.Category))
	}
	if evt.IsViewOnce {
		metaParts = append(metaParts, "view once")
	}
	if evt.IsEphemeral {
		metaParts = append(metaParts, "ephemeral")
	}

	log.Info().Str("id", evt.Info.ID).Str("source", evt.Info.SourceString()).Str("parts", strings.Join(metaParts, ", ")).Msg("Message Received (async processing)")

	// Extract message text content
	var messageText string
	if conv := evt.Message.GetConversation(); conv != "" {
		messageText = conv
	} else if ext := evt.Message.GetExtendedTextMessage(); ext != nil && ext.GetText() != "" {
		messageText = ext.GetText()
	}

	if messageText != "" {
		postmap["body"] = messageText
	}

	// Add media type information WITHOUT downloading (for performance)
	if evt.Message.GetImageMessage() != nil {
		postmap["mediaType"] = "image"
		postmap["mimeType"] = evt.Message.GetImageMessage().GetMimetype()
	} else if evt.Message.GetVideoMessage() != nil {
		postmap["mediaType"] = "video"
		postmap["mimeType"] = evt.Message.GetVideoMessage().GetMimetype()
	} else if evt.Message.GetAudioMessage() != nil {
		postmap["mediaType"] = "audio"
		postmap["mimeType"] = evt.Message.GetAudioMessage().GetMimetype()
	} else if evt.Message.GetDocumentMessage() != nil {
		postmap["mediaType"] = "document"
		postmap["mimeType"] = evt.Message.GetDocumentMessage().GetMimetype()
		if evt.Message.GetDocumentMessage().FileName != nil {
			postmap["fileName"] = *evt.Message.GetDocumentMessage().FileName
		}
	} else if evt.Message.GetStickerMessage() != nil {
		postmap["mediaType"] = "sticker"
		postmap["mimeType"] = evt.Message.GetStickerMessage().GetMimetype()
	}

	// Add basic message info
	postmap["from"] = evt.Info.Sender.String()
	postmap["to"] = evt.Info.Chat.String()
	postmap["id"] = evt.Info.ID
	postmap["timestamp"] = evt.Info.Timestamp.Unix()

	// Add session info (own JID/number)
	mycli.addSessionInfo(postmap)

	// Check if message is from a group and add group metadata
	if evt.Info.IsGroup {
		groupJID := evt.Info.Chat
		cacheKey := groupJID.String()

		// Try to get from cache first
		var groupMetadata map[string]interface{}
		if cached, found := groupInfoCache.Get(cacheKey); found {
			groupMetadata = cached.(map[string]interface{})
			log.Debug().Str("groupJID", groupJID.String()).Msg("Using cached group info")
		} else {
			// Not in cache, fetch from WhatsApp
			groupInfo, err := mycli.WAClient.GetGroupInfo(context.Background(), groupJID)
			if err != nil {
				log.Warn().Err(err).Str("groupJID", groupJID.String()).Msg("Failed to get group info for webhook")
			} else {
				log.Debug().Str("groupJID", groupJID.String()).Msg("Fetched fresh group info from WhatsApp")
				// Build participants array with detailed info
				participants := make([]map[string]interface{}, 0, len(groupInfo.Participants))
				for _, participant := range groupInfo.Participants {
					participantData := map[string]interface{}{
						"id":           participant.JID.String(),
						"isAdmin":      participant.IsAdmin,
						"isSuperAdmin": participant.IsSuperAdmin,
						"phoneNumber":  participant.PhoneNumber,
					}

					// Add LID if available
					if !participant.LID.IsEmpty() {
						participantData["lid"] = participant.LID.String()
					}

					participants = append(participants, participantData)
				}

				groupMetadata = map[string]interface{}{
					"id":             groupInfo.JID.String(),
					"subject":        groupInfo.Name,
					"subjectOwner":   groupInfo.OwnerJID.String(),
					"participants":   participants,
					"size":           len(groupInfo.Participants),
					"isAnnounce":     groupInfo.IsAnnounce,
					"isLocked":       groupInfo.IsLocked,
					"desc":           groupInfo.GroupTopic.Topic,
					"addressingMode": groupInfo.AddressingMode,
				}

				// Cache the group metadata for 5 minutes
				groupInfoCache.Set(cacheKey, groupMetadata, cache.DefaultExpiration)
			}
		}

		if groupMetadata != nil {
			postmap["groupMetadata"] = groupMetadata
		}
	}

	// Send webhook
	sendEventWithWebHook(mycli, postmap, "")
}

func checkIfSubscribedToEvent(subscribedEvents []string, eventType string, userId string) bool {
	// Special case: HistorySync is excluded when "All" is selected
	if eventType == "HistorySync" && Find(subscribedEvents, "All") && !Find(subscribedEvents, "HistorySync") {
		log.Warn().
			Str("type", eventType).
			Strs("subscribedEvents", subscribedEvents).
			Str("userID", userId).
			Msg("Skipping HistorySync webhook. HistorySync is disabled when 'All' is selected")
		return false
	}

	if !Find(subscribedEvents, eventType) && !Find(subscribedEvents, "All") {
		log.Warn().
			Str("type", eventType).
			Strs("subscribedEvents", subscribedEvents).
			Str("userID", userId).
			Msg("Skipping webhook. Not subscribed for this type")
		return false
	}
	return true
}

// Connects to Whatsapp Websocket on server startup if last state was connected
func (s *server) connectOnStartup() {
	rows, err := s.db.Queryx("SELECT id,name,token,jid,webhook,events,proxy_url,CASE WHEN s3_enabled THEN 'true' ELSE 'false' END AS s3_enabled,media_delivery FROM users WHERE connected=1")
	if err != nil {
		log.Error().Err(err).Msg("DB Problem")
		return
	}
	defer rows.Close()
	for rows.Next() {
		txtid := ""
		token := ""
		jid := ""
		name := ""
		webhook := ""
		events := ""
		proxy_url := ""
		s3_enabled := ""
		media_delivery := ""
		err = rows.Scan(&txtid, &name, &token, &jid, &webhook, &events, &proxy_url, &s3_enabled, &media_delivery)
		if err != nil {
			log.Error().Err(err).Msg("DB Problem")
			return
		} else {
			log.Info().Str("token", token).Msg("Connect to Whatsapp on startup")
			v := Values{map[string]string{
				"Id":            txtid,
				"Name":          name,
				"Jid":           jid,
				"Webhook":       webhook,
				"Token":         token,
				"Proxy":         proxy_url,
				"Events":        events,
				"S3Enabled":     s3_enabled,
				"MediaDelivery": media_delivery,
			}}
			userinfocache.Set(token, v, cache.NoExpiration)
			// Gets and set subscription to webhook events
			eventarray := strings.Split(events, ",")

			var subscribedEvents []string
			if len(eventarray) == 1 && eventarray[0] == "" {
				subscribedEvents = []string{}
			} else {
				for _, arg := range eventarray {
					if !Find(supportedEventTypes, arg) {
						log.Warn().Str("Type", arg).Msg("Event type discarded")
						continue
					}
					if !Find(subscribedEvents, arg) {
						subscribedEvents = append(subscribedEvents, arg)
					}
				}

			}
			eventstring := strings.Join(subscribedEvents, ",")
			log.Info().Str("events", eventstring).Str("jid", jid).Msg("Attempt to connect")
			killchannel[txtid] = make(chan bool)
			go s.startClient(txtid, jid, token, subscribedEvents)

			// Initialize S3 client if configured
			go func(userID string) {
				var s3Config struct {
					Enabled       bool   `db:"s3_enabled"`
					Endpoint      string `db:"s3_endpoint"`
					Region        string `db:"s3_region"`
					Bucket        string `db:"s3_bucket"`
					AccessKey     string `db:"s3_access_key"`
					SecretKey     string `db:"s3_secret_key"`
					PathStyle     bool   `db:"s3_path_style"`
					PublicURL     string `db:"s3_public_url"`
					RetentionDays int    `db:"s3_retention_days"`
				}

				err := s.db.Get(&s3Config, `
					SELECT s3_enabled, s3_endpoint, s3_region, s3_bucket, 
						   s3_access_key, s3_secret_key, s3_path_style, 
						   s3_public_url, s3_retention_days
					FROM users WHERE id = $1`, userID)

				if err != nil {
					log.Error().Err(err).Str("userID", userID).Msg("Failed to get S3 config")
					return
				}

				if s3Config.Enabled {
					config := &S3Config{
						Enabled:       s3Config.Enabled,
						Endpoint:      s3Config.Endpoint,
						Region:        s3Config.Region,
						Bucket:        s3Config.Bucket,
						AccessKey:     s3Config.AccessKey,
						SecretKey:     s3Config.SecretKey,
						PathStyle:     s3Config.PathStyle,
						PublicURL:     s3Config.PublicURL,
						RetentionDays: s3Config.RetentionDays,
					}

					err = GetS3Manager().InitializeS3Client(userID, config)
					if err != nil {
						log.Error().Err(err).Str("userID", userID).Msg("Failed to initialize S3 client on startup")
					} else {
						log.Info().Str("userID", userID).Msg("S3 client initialized on startup")
					}
				}
			}(txtid)
		}
	}
	err = rows.Err()
	if err != nil {
		log.Error().Err(err).Msg("DB Problem")
	}
}

func parseJID(arg string) (types.JID, bool) {
	if arg[0] == '+' {
		arg = arg[1:]
	}
	if !strings.ContainsRune(arg, '@') {
		return types.NewJID(arg, types.DefaultUserServer), true
	} else {
		recipient, err := types.ParseJID(arg)
		if err != nil {
			log.Error().Err(err).Msg("Invalid JID")
			return recipient, false
		} else if recipient.User == "" {
			log.Error().Err(err).Msg("Invalid JID no server specified")
			return recipient, false
		}
		return recipient, true
	}
}

func (s *server) startClient(userID string, textjid string, token string, subscriptions []string) {
	log.Info().Str("userid", userID).Str("jid", textjid).Msg("Starting websocket connection to Whatsapp")

	var deviceStore *store.Device
	var err error

	// First handle the device store initialization
	if textjid != "" {
		jid, _ := parseJID(textjid)
		deviceStore, err = container.GetDevice(context.Background(), jid)
		if err != nil {
			log.Error().Err(err).Msg("Failed to get device")
			deviceStore = container.NewDevice()
		}
	} else {
		log.Warn().Msg("No jid found. Creating new device")
		deviceStore = container.NewDevice()
	}

	if deviceStore == nil {
		log.Warn().Msg("No store found. Creating new one")
		deviceStore = container.NewDevice()
	}

	clientLog := waLog.Stdout("Client", *waDebug, *colorOutput)

	// Create the client with initialized deviceStore
	var client *whatsmeow.Client
	if *waDebug != "" {
		client = whatsmeow.NewClient(deviceStore, clientLog)
	} else {
		client = whatsmeow.NewClient(deviceStore, nil)
	}

	// Disable automatic history sync to improve performance and reduce bandwidth
	// When set to true, history sync must be manually requested via /session/history endpoint
	client.ManualHistorySyncDownload = true
	log.Info().Msg("Automatic history sync disabled - manual download only")

	// Now we can use the client with the manager
	clientManager.SetWhatsmeowClient(userID, client)
	if textjid != "" {
		jid, _ := parseJID(textjid)
		deviceStore, err = container.GetDevice(context.Background(), jid)
		if err != nil {
			panic(err)
		}
	} else {
		log.Warn().Msg("No jid found. Creating new device")
		deviceStore = container.NewDevice()
	}

	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_UNKNOWN.Enum()
	store.DeviceProps.Os = osName

	clientManager.SetWhatsmeowClient(userID, client)
	mycli := MyClient{client, 1, userID, token, subscriptions, s.db}
	mycli.eventHandlerID = mycli.WAClient.AddEventHandler(mycli.myEventHandler)

	// CORREÇÃO: Armazenar o MyClient no clientManager
	clientManager.SetMyClient(userID, &mycli)

	httpClient := resty.New()
	httpClient.SetRedirectPolicy(resty.FlexibleRedirectPolicy(15))
	if *waDebug == "DEBUG" {
		httpClient.SetDebug(true)
	}
	httpClient.SetTimeout(30 * time.Second)
	httpClient.SetTLSClientConfig(&tls.Config{InsecureSkipVerify: true})
	httpClient.OnError(func(req *resty.Request, err error) {
		if v, ok := err.(*resty.ResponseError); ok {
			// v.Response contains the last response from the server
			// v.Err contains the original error
			log.Debug().Str("response", v.Response.String()).Msg("resty error")
			log.Error().Err(v.Err).Msg("resty error")
		}
	})

	// NEW: set proxy if defined in DB (assumes users table contains proxy_url column)
	var proxyURL string
	err = s.db.Get(&proxyURL, "SELECT proxy_url FROM users WHERE id=$1", userID)
	if err == nil && proxyURL != "" {
		httpClient.SetProxy(proxyURL)
	}
	clientManager.SetHTTPClient(userID, httpClient)

	// Check if we have stored credentials (ID is not nil means we have a previous session)
	if client.Store.ID == nil {
		// No ID stored, new login - generate QR code
		log.Info().Msg("No stored credentials found. Starting QR code login process")
		qrChan, err := client.GetQRChannel(context.Background())
		if err != nil {
			// This error means that we're already logged in, so ignore it.
			if !errors.Is(err, whatsmeow.ErrQRStoreContainsID) {
				log.Error().Err(err).Msg("Failed to get QR channel")
				return
			}
		} else {
			err = client.Connect() // Si no conectamos no se puede generar QR
			if err != nil {
				log.Error().Err(err).Msg("Failed to connect client for QR generation")
				return
			}

			myuserinfo, found := userinfocache.Get(token)

			for evt := range qrChan {
				if evt.Event == "code" {
					// Display QR code in terminal (useful for testing/developing)
					if *logType != "json" {
						qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
						fmt.Println("QR code:\n", evt.Code)
					}
					// Store encoded/embeded base64 QR on database for retrieval with the /qr endpoint
					image, _ := qrcode.Encode(evt.Code, qrcode.Medium, 256)
					base64qrcode := "data:image/png;base64," + base64.StdEncoding.EncodeToString(image)
					sqlStmt := `UPDATE users SET qrcode=$1 WHERE id=$2`
					_, err := s.db.Exec(sqlStmt, base64qrcode, userID)
					if err != nil {
						log.Error().Err(err).Msg(sqlStmt)
					} else {
						if found {
							v := updateUserInfo(myuserinfo, "Qrcode", base64qrcode)
							userinfocache.Set(token, v, cache.NoExpiration)
							log.Info().Str("qrcode", base64qrcode).Msg("update cache userinfo with qr code")
						}
					}

					//send QR code with webhook
					postmap := make(map[string]interface{})
					postmap["event"] = evt.Event
					postmap["qrCodeBase64"] = base64qrcode
					postmap["type"] = "QR"

					sendEventWithWebHook(&mycli, postmap, "")

				} else if evt.Event == "timeout" {
					// Clear QR code from DB on timeout
					log.Warn().Msg("QR code timeout - no scan detected")
					sqlStmt := `UPDATE users SET qrcode='', connected=0 WHERE id=$1`
					_, err := s.db.Exec(sqlStmt, userID)
					if err != nil {
						log.Error().Err(err).Msg(sqlStmt)
					} else {
						if found {
							v := updateUserInfo(myuserinfo, "Qrcode", "")
							userinfocache.Set(token, v, cache.NoExpiration)
						}
					}
					log.Warn().Msg("QR timeout - cleaning up and stopping client")
					clientManager.DeleteWhatsmeowClient(userID)
					clientManager.DeleteMyClient(userID)
					clientManager.DeleteHTTPClient(userID)
					if ch, ok := killchannel[userID]; ok {
						ch <- true
						delete(killchannel, userID)
					}
					return
				} else if evt.Event == "success" {
					log.Info().Msg("QR pairing ok!")
					// Clear QR code after pairing
					sqlStmt := `UPDATE users SET qrcode='', connected=1 WHERE id=$1`
					_, err := s.db.Exec(sqlStmt, userID)
					if err != nil {
						log.Error().Err(err).Msg(sqlStmt)
					} else {
						if found {
							v := updateUserInfo(myuserinfo, "Qrcode", "")
							userinfocache.Set(token, v, cache.NoExpiration)
						}
					}
				} else {
					log.Info().Str("event", evt.Event).Msg("Login event")
				}
			}
		}

	} else {
		// Already logged in, just connect with stored credentials
		log.Info().Str("jid", client.Store.ID.String()).Msg("Stored credentials found. Attempting to reconnect with saved session")

		// Retry logic for initial connection
		for i := 0; i < 10; i++ {
			err = client.Connect()
			if err == nil {
				break
			}
			log.Warn().Err(err).Int("attempt", i+1).Msg("Failed to connect, retrying...")
			time.Sleep(time.Duration(i*2+2) * time.Second)
		}

		if err != nil {
			log.Error().Err(err).Str("jid", client.Store.ID.String()).Msg("Failed to connect with stored credentials after retries")
			// Don't panic - just log and return so the client can be manually reconnected
			// The session data is still intact and can be used later
			sqlStmt := `UPDATE users SET connected=0 WHERE id=$1`
			_, dbErr := s.db.Exec(sqlStmt, userID)
			if dbErr != nil {
				log.Error().Err(dbErr).Msg("Failed to update connected status in DB")
			}
			return
		}
		log.Info().Str("jid", client.Store.ID.String()).Msg("Successfully reconnected with stored credentials")
	}

	// Keep connected client live until disconnected/killed
	kchan := killchannel[userID]
	for {
		select {
		case <-kchan:
			log.Info().Str("userid", userID).Msg("Received kill signal")
			client.Disconnect()
			clientManager.DeleteWhatsmeowClient(userID)
			clientManager.DeleteMyClient(userID)
			clientManager.DeleteHTTPClient(userID)
			sqlStmt := `UPDATE users SET qrcode='', connected=0 WHERE id=$1`
			_, err := s.db.Exec(sqlStmt, userID)
			if err != nil {
				log.Error().Err(err).Msg(sqlStmt)
			}
			return
		default:
			time.Sleep(1000 * time.Millisecond)
			//log.Info().Str("jid",textjid).Msg("Loop the loop")
		}
	}
}

func fileToBase64(filepath string) (string, string, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return "", "", err
	}
	mimeType := http.DetectContentType(data)
	return base64.StdEncoding.EncodeToString(data), mimeType, nil
}

func (mycli *MyClient) myEventHandler(rawEvt interface{}) {
	txtid := mycli.userID
	postmap := make(map[string]interface{})
	postmap["event"] = rawEvt
	dowebhook := 0
	path := ""

	switch evt := rawEvt.(type) {
	case *events.AppStateSyncComplete:
		if len(mycli.WAClient.Store.PushName) > 0 && evt.Name == appstate.WAPatchCriticalBlock {
			// Send available presence first to ensure proper sync
			err := mycli.WAClient.SendPresence(context.Background(), types.PresenceAvailable)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to send available presence")
			} else {
				log.Info().Msg("Marked self as available temporarily")
			}

			// After 3 seconds, set to unavailable to avoid being always online
			go func() {
				time.Sleep(3 * time.Second)
				err := mycli.WAClient.SendPresence(context.Background(), types.PresenceUnavailable)
				if err != nil {
					log.Warn().Err(err).Msg("Failed to send unavailable presence")
				} else {
					log.Info().Msg("Automatically marked self as unavailable (invisible)")
				}
			}()
		}
	case *events.Connected, *events.PushNameSetting:
		postmap["type"] = "Connected"
		dowebhook = 1
		// Add session info
		mycli.addSessionInfo(postmap)
		if len(mycli.WAClient.Store.PushName) == 0 {
			break
		}
		// Send presence available when connecting to ensure proper sync
		err := mycli.WAClient.SendPresence(context.Background(), types.PresenceAvailable)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to send available presence")
		} else {
			log.Info().Msg("Marked self as available temporarily")
		}

		// After 3 seconds, automatically set to unavailable
		go func() {
			time.Sleep(3 * time.Second)
			err := mycli.WAClient.SendPresence(context.Background(), types.PresenceUnavailable)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to send unavailable presence")
			} else {
				log.Info().Msg("Automatically marked self as unavailable (invisible)")
			}
		}()

		sqlStmt := `UPDATE users SET connected=1 WHERE id=$1`
		_, err = mycli.db.Exec(sqlStmt, mycli.userID)
		if err != nil {
			log.Error().Err(err).Msg(sqlStmt)
			return
		}
	case *events.PairSuccess:
		log.Info().Str("userid", mycli.userID).Str("token", mycli.token).Str("ID", evt.ID.String()).Str("BusinessName", evt.BusinessName).Str("Platform", evt.Platform).Msg("QR Pair Success")
		jid := evt.ID
		sqlStmt := `UPDATE users SET jid=$1 WHERE id=$2`
		_, err := mycli.db.Exec(sqlStmt, jid, mycli.userID)
		if err != nil {
			log.Error().Err(err).Msg(sqlStmt)
			return
		}

		myuserinfo, found := userinfocache.Get(mycli.token)
		if !found {
			log.Warn().Msg("No user info cached on pairing?")
		} else {
			txtid = myuserinfo.(Values).Get("Id")
			token := myuserinfo.(Values).Get("Token")
			v := updateUserInfo(myuserinfo, "Jid", fmt.Sprintf("%s", jid))
			userinfocache.Set(token, v, cache.NoExpiration)
			log.Info().Str("jid", jid.String()).Str("userid", txtid).Str("token", token).Msg("User information set")
		}
	case *events.StreamReplaced:
		log.Info().Msg("Received StreamReplaced event")
		return
	case *events.Message:
		// Process message asynchronously to avoid blocking the event handler
		go mycli.processMessageAsync(evt)
		return
	case *events.AppState:
		log.Info().Str("index", fmt.Sprintf("%+v", evt.Index)).Str("actionValue", fmt.Sprintf("%+v", evt.SyncActionValue)).Msg("App state event received")
	case *events.LoggedOut:
		postmap["type"] = "Logged Out"
		dowebhook = 1
		// Add session info (should be available even when logging out)
		mycli.addSessionInfo(postmap)
		log.Info().Str("reason", evt.Reason.String()).Msg("Logged out")
		killchannel[mycli.userID] <- true
		sqlStmt := `UPDATE users SET connected=0 WHERE id=$1`
		_, err := mycli.db.Exec(sqlStmt, mycli.userID)
		if err != nil {
			log.Error().Err(err).Msg(sqlStmt)
			return
		}
	case *events.CallOffer:
		log.Info().Str("event", fmt.Sprintf("%+v", evt)).Msg("Got call offer")
	case *events.CallAccept:
		log.Info().Str("event", fmt.Sprintf("%+v", evt)).Msg("Got call accept")
	case *events.CallTerminate:
		log.Info().Str("event", fmt.Sprintf("%+v", evt)).Msg("Got call terminate")
	case *events.CallOfferNotice:
		log.Info().Str("event", fmt.Sprintf("%+v", evt)).Msg("Got call offer notice")
	case *events.CallRelayLatency:
		log.Info().Str("event", fmt.Sprintf("%+v", evt)).Msg("Got call relay latency")
	case *events.Disconnected:
		postmap["type"] = "Disconnected"
		dowebhook = 1
		// Add session info
		mycli.addSessionInfo(postmap)
		log.Info().Str("reason", fmt.Sprintf("%+v", evt)).Msg("Disconnected from Whatsapp")

		// Attempt automatic reconnection if we have stored credentials
		if mycli.WAClient.Store.ID != nil {
			log.Info().Str("jid", mycli.WAClient.Store.ID.String()).Msg("Attempting automatic reconnection after disconnect")
			go func() {
				// Retry loop with backoff
				for i := 0; i < 15; i++ {
					// Wait a bit before reconnecting (exponential backoff: 2, 4, 8, 16...)
					sleepTime := time.Duration(2<<i) * time.Second
					if sleepTime > 60*time.Second {
						sleepTime = 60 * time.Second
					}
					log.Info().Int("attempt", i+1).Dur("wait", sleepTime).Msg("Waiting before reconnection attempt")
					time.Sleep(sleepTime)

					// Check if client still exists in manager
					if clientManager.GetWhatsmeowClient(mycli.userID) == nil {
						log.Warn().Str("userID", mycli.userID).Msg("Client no longer exists in manager, skipping reconnection")
						return
					}

					// Check if already connected
					if mycli.WAClient.IsConnected() {
						log.Info().Msg("Client already connected, stopping reconnection loop")
						return
					}

					log.Info().Int("attempt", i+1).Msg("Reconnecting...")
					err := mycli.WAClient.Connect()
					if err != nil {
						log.Error().Err(err).Str("jid", mycli.WAClient.Store.ID.String()).Msg("Failed to automatically reconnect")
					} else {
						log.Info().Str("jid", mycli.WAClient.Store.ID.String()).Msg("Successfully reconnected automatically")
						// Update DB to reflect connected state
						sqlStmt := `UPDATE users SET connected=1 WHERE id=$1`
						_, dbErr := mycli.db.Exec(sqlStmt, mycli.userID)
						if dbErr != nil {
							log.Error().Err(dbErr).Msg("Failed to update connected status in DB")
						}
						return // Success
					}
				}

				// If we exhausted retries
				log.Error().Msg("Exhausted reconnection attempts")
				sqlStmt := `UPDATE users SET connected=0 WHERE id=$1`
				_, dbErr := mycli.db.Exec(sqlStmt, mycli.userID)
				if dbErr != nil {
					log.Error().Err(dbErr).Msg("Failed to update connected status in DB")
				}
			}()
		} else {
			log.Warn().Msg("No stored credentials for automatic reconnection")
		}
	case *events.ConnectFailure:
		postmap["type"] = "ConnectFailure"
		dowebhook = 1
		// Add session info
		mycli.addSessionInfo(postmap)
		log.Error().Str("reason", fmt.Sprintf("%+v", evt)).Msg("Failed to connect to Whatsapp")

		// Attempt automatic reconnection if we have stored credentials
		if mycli.WAClient.Store.ID != nil {
			log.Info().Str("jid", mycli.WAClient.Store.ID.String()).Msg("Attempting automatic reconnection after connection failure")
			go func() {
				// Retry loop with backoff
				for i := 0; i < 15; i++ {
					// Wait a bit before reconnecting (exponential backoff: 2, 4, 8, 16...)
					sleepTime := time.Duration(2<<i) * time.Second
					if sleepTime > 60*time.Second {
						sleepTime = 60 * time.Second
					}
					log.Info().Int("attempt", i+1).Dur("wait", sleepTime).Msg("Waiting before reconnection attempt (ConnectFailure)")
					time.Sleep(sleepTime)

					// Check if client still exists in manager
					if clientManager.GetWhatsmeowClient(mycli.userID) == nil {
						log.Warn().Str("userID", mycli.userID).Msg("Client no longer exists in manager, skipping reconnection")
						return
					}

					// Check if already connected
					if mycli.WAClient.IsConnected() {
						log.Info().Msg("Client already connected, stopping reconnection loop")
						return
					}

					log.Info().Int("attempt", i+1).Msg("Reconnecting...")
					err := mycli.WAClient.Connect()
					if err != nil {
						log.Error().Err(err).Str("jid", mycli.WAClient.Store.ID.String()).Msg("Failed to automatically reconnect after connection failure")
					} else {
						log.Info().Str("jid", mycli.WAClient.Store.ID.String()).Msg("Successfully reconnected automatically after connection failure")
						// Update DB to reflect connected state
						sqlStmt := `UPDATE users SET connected=1 WHERE id=$1`
						_, dbErr := mycli.db.Exec(sqlStmt, mycli.userID)
						if dbErr != nil {
							log.Error().Err(dbErr).Msg("Failed to update connected status in DB")
						}
						return // Success
					}
				}

				// If we exhausted retries
				log.Error().Msg("Exhausted reconnection attempts after connection failure")
				sqlStmt := `UPDATE users SET connected=0 WHERE id=$1`
				_, dbErr := mycli.db.Exec(sqlStmt, mycli.userID)
				if dbErr != nil {
					log.Error().Err(dbErr).Msg("Failed to update connected status in DB")
				}
			}()
		} else {
			log.Warn().Msg("No stored credentials for automatic reconnection")
		}
	case *events.GroupInfo:
		postmap["type"] = "GroupInfo"
		dowebhook = 1
		// Add session info
		mycli.addSessionInfo(postmap)
		log.Info().Str("group", evt.JID.String()).Msg("Group info changed")
	case *events.JoinedGroup:
		postmap["type"] = "JoinedGroup"
		dowebhook = 1
		// Add session info
		mycli.addSessionInfo(postmap)
		log.Info().Str("group", evt.JID.String()).Msg("Joined group")
	default:
		log.Warn().Str("event", fmt.Sprintf("%+v", evt)).Msg("Unhandled event")
	}

	if dowebhook == 1 {
		sendEventWithWebHook(mycli, postmap, path)
	}
}
