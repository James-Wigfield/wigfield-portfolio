| Cell | Type | In | Section | First line |
|---|---|---|---|---|
| 0 | markdown |  | title | # CITS5017 Project 2: Forecasting Perth Temperatures with GRUs, and Sy |
| 1 | markdown |  | s1 | ## 1. Setup |
| 2 | code | 1 | s1 | import os · 1 out |
| 3 | markdown |  | s2 | ## 2. Loading the data |
| 4 | code | 2 | s2 | def load_data(picklefile): · 1 out |
| 5 | code | 3 | s2 | for name, seq in [("train", train_seq), ("val", val_seq), ("test", tes · 1 out |
| 6 | markdown |  | s2 | The three sets are not interchangeable. Bickley averages 11.3 degrees  |
| 7 | markdown |  | part-i | # Part (i): Forecasting minimum and maximum temperatures |
| 8 | markdown |  | s3 | ## 3. Splitting into input and target sequences |
| 9 | code | 4 | s3 | INPUT_LENGTH = 72 · 1 out |
| 10 | markdown |  | s4 | ## 4. Visualising the sequences |
| 11 | code | 5 | s4 | def display_temperatures(X, y, y_pred=None, indices=None, title=None): · 0 out |
| 12 | code | 6 | s4 | display_temperatures(X_train, y_train, title="Training set (Perth Airp · 3 out, 3 fig |
| 13 | markdown |  | s4 | The annual cycle dominates every sequence: six full cycles in the 72 i |
| 14 | markdown |  | s5 | ## 5. Shared helpers |
| 15 | code | 7 | s5 | LEARNING_RATE = 3e-3 · 1 out |
| 16 | markdown |  | s6 | ## 6. Model 1: two-layer GRU predicting 12 months at once |
| 17 | code | 8 | s6 | model1 = build_gru_model(TARGET_LENGTH, name="model1") · 5 out |
| 18 | code | 9 | s6 | history1 = train_model(model1, X_train, y_train, X_val, y_val) · 2 out, 1 fig |
| 19 | markdown |  | s6 | Training stopped after 66 epochs and restored epoch 46, where the vali |
| 20 | code | 10 | s6 | y_pred1 = model1(X_test, training=False) · 2 out, 1 fig |
| 21 | markdown |  | s6 | On the test set the MAE is 1.250 degrees, compared with 0.988 on valid |
| 22 | markdown |  | s7 | ## 7. Model 2: two-layer GRU predicting 1 month, rolled out to 12 |
| 23 | code | 11 | s7 | model2 = build_gru_model(1, name="model2") · 5 out |
| 24 | code | 12 | s7 | # only the first target month is used: shapes (1522, 1, 2) and (313, 1 · 2 out, 1 fig |
| 25 | markdown |  | s7 | Model 2 has the least tidy curve of the three. Early stopping ended it |
| 26 | code | 13 | s7 | y_pred2_1 = model2(X_test, training=False) · 2 out, 1 fig |
| 27 | markdown |  | s7 | The one-month test MAE is 1.188 degrees. In the three examples the pre |
| 28 | code | 14 | s7 | def predict_recursively(model, X, n_steps): · 2 out, 1 fig |
| 29 | markdown |  | s7 | Rolled out to 12 months the test MAE is 1.407 degrees, up from 1.188 f |
| 30 | markdown |  | s8 | ## 8. Model 3: GRU encoder-decoder |
| 31 | code | 15 | s8 | def build_encoder_decoder(units=GRU_UNITS): · 15 out |
| 32 | code | 16 | s8 | history3 = train_model(model3, [X_train, decoder_inputs(X_train, y_tra · 2 out, 1 fig |
| 33 | markdown |  | s8 | Early stopping cut model 3 off at epoch 50 and kept the weights from e |
| 34 | code | 17 | s8 | y_pred3 = predict_encoder_decoder(encoder, decoder, X_test, TARGET_LEN · 2 out, 1 fig |
| 35 | markdown |  | s8 | With the decoder running on its own predictions the test MAE is 1.321  |
| 36 | markdown |  | s9 | ## 9. Comparing models 2 and 3 over longer prediction horizons |
| 37 | code | 18 | s9 | HORIZONS = [12, 15, 18, 21, 24] · 6 out, 1 fig |
| 38 | code | 19 | s9 | # error for each month ahead, averaged over the 297 sequences and both · 3 out, 1 fig |
| 39 | markdown |  | s9 | ### Discussion |
| 40 | markdown |  | part-ii | # Part (ii): Synthesising maximum temperature sequences with a VAE |
| 41 | markdown |  | s10 | ## 10. Data preparation |
| 42 | code | 20 | s10 | SEQ_LENGTH = 84 · 1 out |
| 43 | markdown |  | s11 | ## 11. VAE model |
| 44 | code | 21 | s11 | CODINGS_SIZE = 4 · 10 out |
| 45 | code | 22 | s11 | history_vae = train_model(vae, z_train, z_train, z_val, z_val, metrics · 3 out, 1 fig |
| 46 | markdown |  | s11 | The VAE ran for 43 epochs. The best total validation loss, 0.0950, cam |
| 47 | markdown |  | s12 | ## 12. Synthesised sequences |
| 48 | code | 23 | s12 | def plot_sequences(sequences, title, ncols=3): · 3 out, 2 fig |
| 49 | markdown |  | s12 | ### Discussion |
| 50 | markdown |  | s13 | ## 13. Summary |
