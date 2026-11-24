# memory.md: Kepler Exoplanet Detection (ML mini-project)

Handoff file for an AI agent. It records the project context, decisions, code state, real results, and what remains. All numbers below come from the student's real runs, not estimates.

---

## 1. Project at a glance

- **Course:** Machine Learning, L3 DSI, ISET Sfax, Département Technologies de l'Informatique
- **Teachers:** M. Sami HADHRI, Mme Manel BEN SALAH
- **Work format:** pair (binôme). Names still to fill in: `Nom Prénom 1 / Nom Prénom 2`
- **Deadline:** 22 November 2026. **It has already passed** (today at time of writing: 24 Nov 2026). The student should email the teachers to ask for an extension.
- **Topic:** binary classification of Kepler Objects of Interest (KOI): real exoplanet (`CONFIRMED`) vs `FALSE POSITIVE`, using only physical measurements.
- **Dataset:** `cumulative.csv` (NASA Exoplanet Archive, republished on Kaggle). **Kaggle URL still missing** ("à insérer").
- **Bonus allowed by the teacher:** KNIME (visual workflow). Not started.

### Deliverables required by the cahier de charges
1. Dataset (file or link)
2. Well-documented Jupyter notebook
3. Written report (method, analyses, results, conclusions, challenges and solutions)
4. Oral presentation (slides)

### Required tasks (all covered by the notebook so far)
Acquisition, preprocessing (missing values, encoding, scaling), exploration/visualization, several classifiers incl. bagging/boosting with cross-validation, evaluation (precision, recall, F1, AUC-ROC, tables and charts), hyperparameter tuning, documentation.

---

## 2. About the student (how to help)

- **No astronomy background.** Explain everything in plain, simple words, with everyday analogies (a "dip" = a star looking slightly dimmer, like a moth passing in front of a lamp; "noise" = random wobble; "signal-to-noise" = how clearly the dip stands out).
- Writes in English, but the project description and the likely report are in **French**. The report language was not yet confirmed (offer French).
- Preferred workflow: one step at a time. The assistant gives notebook cells, the student runs them and pastes the output, then continues. Keep this style.
- Also asks "what did cell X do in simple terms". Keep a plain-language summary after each code block.
- Be honest about uncertainty. The assistant made a few mistakes earlier (see section 9). Never invent numbers.

---

## 3. Dataset facts (confirmed from the real file)

- Shape: **9,564 rows x 50 columns** (the project description said "about 9,500", update it to 9,564).
- `koi_disposition` counts: FALSE POSITIVE 5,023 | CONFIRMED 2,293 | CANDIDATE 2,248.
- After removing CANDIDATE: **7,316 rows**, 68.7% false positive (target 0) / 31.3% confirmed (target 1). A moderate imbalance, so use recall, F1, AUC-ROC and stratified splits.
- **Columns that do NOT exist** in this file (remove them from the project description, sections 3.2 and 6): `koi_sma`, `koi_smass`, `koi_num_transits`, `koi_max_mult_ev`, `koi_disp_prov`, `koi_comment`.
- Only text columns: `kepoi_name` (identifier, 9,564 unique), `kepler_name` (76% missing, names are only given to confirmed planets, so it leaks), `koi_disposition` (target), `koi_pdisposition` (leak), `koi_tce_delivname` (3 values + 346 missing).
- 100% empty: `koi_teq_err1`, `koi_teq_err2`.
- Other missing values are small (max about 5.6% per column), so median imputation is fine.

### Column decisions
| Group | Columns | Decision |
|---|---|---|
| Identifiers | `rowid`, `kepid`, `kepoi_name` | Dropped |
| Leaks (reveal the answer) | `kepler_name`, `koi_pdisposition`, `koi_score`, `koi_fpflag_nt/ss/co/ec` | Dropped |
| Target source | `koi_disposition` | Converted to `target`, then dropped |
| Empty | `koi_teq_err1`, `koi_teq_err2` | Dropped |
| Sky position | `ra`, `dec` | Dropped (a choice, not a strict rule: no physical link to being a planet) |
| Pipeline proxies | `koi_tce_delivname`, `koi_tce_plnt_num` | **Excluded from main models**, used only in an ablation |
| Error columns | `*_err1`, `*_err2` | Left out of the main models for now (could be tested later) |
| **Main numeric features (13)** | `koi_period`, `koi_time0bk`, `koi_impact`, `koi_duration`, `koi_depth`, `koi_prad`, `koi_teq`, `koi_insol`, `koi_model_snr`, `koi_steff`, `koi_slogg`, `koi_srad`, `koi_kepmag` | Used |
| **Derived categories (4)** | `type_orbite`, `type_planete`, `type_etoile`, `luminosite` | Used (one-hot) |

### Why the proxy columns were suspicious
`koi_tce_delivname` crosstab (rows = version, columns = target 0 / 1):

| Version | FP | Confirmed |
|---|---|---|
| missing | 271 | 8 |
| q1_q16_tce | 560 | 1 |
| q1_q17_dr24_tce | 216 | 3 |
| q1_q17_dr25_tce | 3,976 | 2,281 |

99.5% of confirmed planets are in one version, so the column reflects processing history, not physics. `koi_tce_plnt_num` has some real signal (stars with several signals are more often real, numbers 2 to 4 are 64% to 76% confirmed), but it comes from the pipeline and high values have few objects.

### Derived categories (fixed thresholds, so no leakage)
- `type_orbite` from `koi_period`: bins [0, 10, 100, inf] -> short / medium / long
- `type_planete` from `koi_prad`: [0, 1.25, 2, 6, inf] -> earth_like / super_earth / neptune_like / jupiter_like
- `type_etoile` from `koi_steff`: [0, 5200, 6000, inf] -> cool / sun_like / hot
- `luminosite` from `koi_kepmag`: [0, 13, 15, inf] -> bright / medium / faint

Honest limitation: these are binned versions of numeric columns, so they add no new information. The categorical column requirement is met formally. Say this openly in the report.

---

## 4. Code state (Jupyter notebook, cell by cell)

Environment seen in tracebacks: Windows, Python 3.14, pandas 3 (`str` dtype), recent scikit-learn.

| Cell | What it does |
|---|---|
| 1 | Imports, `RANDOM_STATE = 42`, seaborn style |
| 2 to 4 | Load CSV, print shape/columns, `head()`, class counts, missing-value ranking |
| 5 | Remove CANDIDATE, create `target` (1 = CONFIRMED) |
| 6 | Drop identifiers, leaks, original target, empty columns |
| 7 | `proxy_cols = ["koi_tce_delivname", "koi_tce_plnt_num"]`, drop `ra`/`dec`, print dtypes/missing. **The proxy columns are still in `data` at this point on purpose** (needed for Cell 12) |
| 8 | Class balance bar chart |
| 9 | Histograms of 12 main measurements (log10 for skewed ones) |
| 10 | Boxplots by class (log10 for skewed ones) |
| 11 | Correlation heatmap + correlation with target |
| 12 | Crosstabs for the two proxy columns |
| 13 | Create 4 derived categories with `pd.cut` |
| 14 | Feature lists; `X_main` (13 numeric + 4 categories), `X_ablation` (same + proxy cols), `y`; `log_cols = [koi_period, koi_duration, koi_depth, koi_prad, koi_model_snr, koi_insol]` |
| 15 | Stratified 80/20 split by index (`test_size=0.2`, `random_state=42`) so both X versions use identical rows. Train = 5,852 rows, test = 1,464 rows |
| 16 | `make_preprocessor(num_cols, log_cols, cat_cols)` returns a `ColumnTransformer`: median impute + scale; median impute + `log1p` + scale; most-frequent impute + one-hot. **Fix applied:** `FunctionTransformer(np.log1p, feature_names_out="one-to-one")`. Creates `prep_main` and `prep_ablation` |
| 17 | Sanity check: output shape (5852, 26), no NaN |
| 18 | Quick test with logistic regression: CV F1 mean 0.805 |
| 19 | 8 models in a `Pipeline(prep + model)`, `StratifiedKFold(5, shuffle=True, random_state=42)`, scoring precision/recall/F1/ROC-AUC |
| 20 | Grouped bar chart (optional fix: legend with `bbox_to_anchor=(1.01, 1)`; note the y-axis starts at 0.5) |
| 21 | `RandomizedSearchCV` (20 iterations, scoring F1) for Random Forest and Gradient Boosting |
| 22 | Test-set classification reports and ROC curves |
| 23 | Final model chosen by CV score, confusion matrix |
| 24 | Ablation: final Gradient Boosting with/without proxy columns |
| 25 | Permutation importance on the test set (F1, 10 repeats) |

Rule followed throughout: imputation, log and scaling are **inside the Pipeline**, so they are fitted on training folds only (no leakage). The test set is untouched until Cell 22.

---

## 5. Real results

### 5.1 Cross-validation on the training set (5-fold stratified, before tuning)
| Model | Precision | Recall | F1 | AUC-ROC | F1 std |
|---|---|---|---|---|---|
| Bagging | 0.873 | 0.877 | 0.875 | 0.969 | 0.005 |
| Gradient Boosting | 0.866 | 0.880 | 0.873 | 0.972 | 0.007 |
| Random Forest | 0.875 | 0.870 | 0.872 | 0.973 | 0.006 |
| SVM (RBF) | 0.855 | 0.884 | 0.869 | 0.967 | 0.008 |
| AdaBoost | 0.835 | 0.853 | 0.844 | 0.958 | 0.006 |
| k-NN | 0.783 | 0.860 | 0.820 | 0.933 | 0.008 |
| Decision Tree | 0.808 | 0.818 | 0.813 | 0.865 | 0.020 |
| Logistic Regression (baseline) | 0.807 | 0.803 | 0.805 | 0.940 | 0.010 |

Interpretation: the top four (Bagging, GB, RF, SVM) are statistically tied (gaps < 0.01, similar to fold-to-fold std). Do not claim a single winner. The single Decision Tree is unstable (std 0.020) and overfits, and ensembles fix this by averaging.

### 5.2 Tuning (RandomizedSearchCV, 20 iterations)
| Model | CV F1 before | CV F1 after | Best parameters |
|---|---|---|---|
| Random Forest | 0.872 | 0.881 | n_estimators=249, max_depth=20, max_features=0.5, min_samples_leaf=1 |
| Gradient Boosting | 0.873 | **0.892** | n_estimators=487, learning_rate=0.0666, max_depth=5, subsample=0.7247 |

Caveats: the best-of-20 CV score is slightly optimistic. Several chosen values sit at the edge of the search range (GB `max_depth=5` is the allowed maximum, `n_estimators=487` is near 500, RF `min_samples_leaf=1`, `max_features=0.5`), so a wider search might give a small extra gain (optional: `randint(2, 9)` for depth).

### 5.3 Final model on the test set: Gradient Boosting (chosen by CV score)
Confusion matrix (1,464 objects, from the student's own screenshot):

| | Predicted FP | Predicted Confirmed |
|---|---|---|
| True FP (1,005) | 960 | 45 |
| True Confirmed (459) | 48 | 411 |

- Accuracy **93.6%** (1,371 / 1,464)
- Confirmed class: precision **0.901**, recall **0.895**, F1 **0.898**
- False-positive class recall: 0.955
- **Test AUC-ROC 0.978** (Random Forest test AUC about 0.973)
- Test scores match CV scores, so there is no sign of overfitting or leakage.
- Errors are balanced (45 fakes called planets, 48 real planets missed).

### 5.4 Ablation: with vs without the proxy columns (Gradient Boosting, tuned)
| Version | CV F1 | Test F1 | Test AUC |
|---|---|---|---|
| Without proxy columns (main) | 0.892 | 0.898 | 0.978 |
| With `koi_tce_delivname` + `koi_tce_plnt_num` | 0.892 | 0.899 | 0.978 |

No difference (0.001 is noise). The earlier expectation that the proxy columns would inflate the score was **wrong**. Interpretation (not proven): the physical measurements already carry the same information. Excluding the proxies costs nothing and is still the principled choice. Report it as a "challenge and solution" item.

### 5.5 Permutation importance (Gradient Boosting, test set, drop in F1)
`koi_model_snr` 0.1725 | `type_planete` 0.1036 | `koi_duration` 0.0924 | `koi_prad` 0.0895 | `koi_period` 0.0845 | `koi_impact` 0.0684 | `koi_srad` 0.0531 | `koi_steff` 0.0271 | `koi_insol` 0.0255 | `koi_slogg` 0.0148 | `koi_depth` 0.0112 | `koi_teq` 0.0088 | `koi_kepmag` 0.0072 | `koi_time0bk` 0.0027 | `type_etoile` 0.0000 | `luminosite` 0.0000 | `type_orbite` -0.0001

Interpretation:
- Signal-to-noise ratio is by far the most useful, then object size (`koi_prad`, `type_planete`), then transit shape/rhythm (duration, period, impact). Host-star properties matter little.
- SNR had only a weak correlation with the target (-0.19) but is the top feature, so correlation (linear) misses what the model uses.
- `koi_depth` ranks low because it shares credit with SNR (corr 0.57) and planet size. It is not useless.
- `type_planete` ranking 2nd is surprising. A possible explanation (unproven) is that its cut points separate objects that are too large to be planets.
- The three other derived categories score about 0 (redundant with their numeric source).
- `koi_time0bk` is near 0, which is reassuring (no physical meaning).
- Importance shows what the model uses, not physical causation.

### 5.6 Exploration findings
- Correlation of main features with target is weak (max |r| = 0.24): `koi_teq` -0.24, `koi_depth` -0.22, `koi_steff` -0.21, `koi_model_snr` -0.19, `koi_period` -0.18, `koi_slogg` +0.17, `koi_duration` -0.15. A combination of features is needed.
- Strong correlations between features: `koi_impact`~`koi_prad` 0.69, `koi_slogg`~`koi_srad` -0.65, `koi_depth`~`koi_model_snr` 0.57, `koi_teq`~`koi_slogg` -0.54, `koi_insol`~`koi_srad` 0.52 (multicollinearity, mention it in the report).
- Skewed variables (period, depth, radius, SNR, insolation, duration) are plotted and transformed on a log scale.

---

## 6. Glossary used with the student (keep explanations this simple)

- **Transit / dip:** a small, regular dimming of a star's light when something passes in front of it.
- **Exoplanet:** a planet orbiting a star other than the Sun.
- **False positive:** a signal that looks like a planet but is not (eclipsing binary stars, starspots, instrument glitches).
- **CANDIDATE:** not yet decided, so excluded from training.
- **CV:** practice exams inside the training data (train on 4/5, test on 1/5, repeat 5 times).
- **Test F1 / Test AUC:** the same scores on the final exam (20% unseen data).
- **Precision:** of the objects called "planet", how many really are. **Recall:** of the real planets, how many were found. **F1:** one number balancing both.
- **Support:** just a count of real objects per class in the test set (1,005 FP / 459 Confirmed).
- **AUC-ROC:** how often a random real planet gets a higher planet-probability than a random fake (0.5 = coin flip, 1.0 = perfect).
- **Std:** how much the 5 fold scores jump around. If two models differ by less than the std, the difference may be luck.
- **Data leakage:** the model sees information that reveals the answer.

---

## 7. Remaining work (priority order)

1. **Email the teachers about the passed deadline** (22 Nov 2026) and ask for an extension.
2. **Written report** (probably in French, ask to confirm). Planned structure: introduction (2-3 plain sentences on transits and false positives), dataset, preprocessing, exploration, models, results, optimization, interpretation, challenges and solutions, conclusion. Challenges to include: data leakage columns, proxy column (ablation), missing values, class imbalance, skewed variables, multicollinearity, weak categorical variables, Python 3.14/pandas 3 and sklearn warnings.
3. **Slides** (about 10): problem, data, method, results, conclusion. Include Kaggle link and names.
4. **Fix the project description:** pair names, Kaggle URL, row count 9,564, remove non-existent columns (`koi_sma`, `koi_smass`, `koi_num_transits`, `koi_max_mult_ev`, `koi_disp_prov`, `koi_comment`).
5. **Notebook polish (optional):** legend position in Cell 20, markdown cells and one-sentence comments under each graph, wider hyperparameter search, test adding the `*_err1/err2` columns.
6. **KNIME bonus (optional):** rebuild a smaller workflow (CSV Reader, Row Filter, Column Filter, Missing Value, Rule Engine, Normalizer + Apply, Partitioning, learners/predictors, Scorer, ROC Curve, X-Partitioner/X-Aggregator). Node names are from memory, so check them in the KNIME search box. KNIME has no direct Bagging/AdaBoost nodes (Random Forest and Gradient Boosted Trees cover the idea). Fit the Normalizer on training data only. The student has not yet said whether KNIME is installed or which version.

---

## 8. Open items to confirm with the student

- Report language (French or English)?
- Cell 13 output (counts of the 4 derived categories) was never pasted. The 26 output columns suggest all groups exist, but the counts should be checked.
- Full test-set classification reports (Random Forest and Gradient Boosting) were only seen as a blurry screenshot, so use the confusion matrix numbers in 5.3 as the reliable source.
- KNIME installed? Which version?

---

## 9. Mistakes already made (do not repeat)

- Said the deadline was "in three days" when it had already passed. The deadline is 22 Nov 2026 and today is 24 Nov 2026.
- Mentioned columns that are not in the file (`koi_num_transits` and others).
- Said the proxy columns would raise the score. They did not.
- Cell 16 first used `FunctionTransformer(np.log1p)` without `feature_names_out`, which broke `get_feature_names_out()`. Fixed.
- Misread a blurry confusion-matrix screenshot (962 vs real 960). Prefer pasted text or large screenshots.
- Said "we excluded" the proxy columns before the code actually did it. They are only removed in Cell 14 (`X_main` vs `X_ablation`).
