# N3.1A — Ledger 86 review questions

Chỉ phân loại câu hỏi đã tồn tại trong báo cáo N3.1. Primary category được đếm một lần; secondary categories không cộng lại. Quantity/negation checks bổ sung xem cards/queue, không giả lập phát hiện NLU mới.

| Category | Primary count |
|---|---:|
| Intent ambiguity | 2 |
| Entity ambiguity | 12 |
| Quantity delta/absolute | 0 |
| Negation/exclusion | 0 |
| Multi-turn reference | 8 |
| Current-turn intent vs accumulated state | 60 |
| Clarification policy | 4 |
| Other | 0 |

| Question | Case | Source code | Primary | Secondary | Card |
|---|---|---|---|---|---|
| Q001 | N2-CON-01 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-con-01) |
| Q002 | N2-CON-02 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-con-02) |
| Q003 | N2-REFMISS-01 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-refmiss-01) |
| Q004 | N2-REFMISS-02 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-refmiss-02) |
| Q005 | N2-BUDGET-01 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-budget-01) |
| Q006 | N2-BUDGET-02 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-budget-02) |
| Q007 | N2-AMBPRICE-01 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-ambprice-01) |
| Q008 | N2-AMBPRICE-02 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-ambprice-02) |
| Q009 | N2-HOLDEX-01 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-holdex-01) |
| Q010 | N2-HOLDEX-02 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-holdex-02) |
| Q011 | N2-HOLDUNKNOWN-01 | absence_vs_ambiguity | Clarification policy | Entity ambiguity | [mở card](review-cards.md#n2-holdunknown-01) |
| Q012 | N2-HOLDUNKNOWN-02 | absence_vs_ambiguity | Clarification policy | Entity ambiguity | [mở card](review-cards.md#n2-holdunknown-02) |
| Q013 | N2-HOLDCOMP-01 | taxonomy_ambiguity | Intent ambiguity | Clarification policy | [mở card](review-cards.md#n2-holdcomp-01) |
| Q014 | N2-HOLDCOMP-02 | taxonomy_ambiguity | Intent ambiguity | Clarification policy | [mở card](review-cards.md#n2-holdcomp-02) |
| Q015 | N2-D-INCREASE-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-increase-1-1) |
| Q016 | N2-D-INCREASE-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-increase-1-2) |
| Q017 | N2-D-INCREASE-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-increase-1-3) |
| Q018 | N2-D-INCREASE-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-increase-2-1) |
| Q019 | N2-D-INCREASE-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-increase-2-2) |
| Q020 | N2-D-INCREASE-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-increase-2-3) |
| Q021 | N2-D-REMOVE-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-remove-1-1) |
| Q022 | N2-D-REMOVE-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-remove-1-2) |
| Q023 | N2-D-REMOVE-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-remove-1-3) |
| Q024 | N2-D-REMOVE-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-remove-2-1) |
| Q025 | N2-D-REMOVE-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-remove-2-2) |
| Q026 | N2-D-REMOVE-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-remove-2-3) |
| Q027 | N2-D-BUDGET-1-1 | clarification_policy | Clarification policy | Intent ambiguity | [mở card](review-cards.md#n2-d-budget-1-1) |
| Q028 | N2-D-BUDGET-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-budget-1-1) |
| Q029 | N2-D-BUDGET-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-budget-1-2) |
| Q030 | N2-D-BUDGET-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-budget-1-3) |
| Q031 | N2-D-BUDGET-1-3 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-d-budget-1-3) |
| Q032 | N2-D-BUDGET-2-1 | clarification_policy | Clarification policy | Intent ambiguity | [mở card](review-cards.md#n2-d-budget-2-1) |
| Q033 | N2-D-BUDGET-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-budget-2-1) |
| Q034 | N2-D-BUDGET-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-budget-2-2) |
| Q035 | N2-D-BUDGET-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-budget-2-3) |
| Q036 | N2-D-BUDGET-2-3 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-d-budget-2-3) |
| Q037 | N2-D-SPICE-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-spice-1-1) |
| Q038 | N2-D-SPICE-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-spice-1-2) |
| Q039 | N2-D-SPICE-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-spice-1-3) |
| Q040 | N2-D-SPICE-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-spice-2-1) |
| Q041 | N2-D-SPICE-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-spice-2-2) |
| Q042 | N2-D-SPICE-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-spice-2-3) |
| Q043 | N2-D-VOLUME-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-volume-1-1) |
| Q044 | N2-D-VOLUME-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-volume-1-2) |
| Q045 | N2-D-VOLUME-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-volume-1-3) |
| Q046 | N2-D-VOLUME-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-volume-2-1) |
| Q047 | N2-D-VOLUME-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-volume-2-2) |
| Q048 | N2-D-VOLUME-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-volume-2-3) |
| Q049 | N2-D-ASSENT-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-assent-1-1) |
| Q050 | N2-D-ASSENT-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-assent-1-2) |
| Q051 | N2-D-ASSENT-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-assent-1-3) |
| Q052 | N2-D-ASSENT-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-assent-2-1) |
| Q053 | N2-D-ASSENT-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-assent-2-2) |
| Q054 | N2-D-ASSENT-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-assent-2-3) |
| Q055 | N2-D-OPTION-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-option-1-1) |
| Q056 | N2-D-OPTION-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-option-1-2) |
| Q057 | N2-D-OPTION-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-option-1-3) |
| Q058 | N2-D-OPTION-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-option-2-1) |
| Q059 | N2-D-OPTION-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-option-2-2) |
| Q060 | N2-D-OPTION-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-option-2-3) |
| Q061 | N2-D-REF-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-ref-1-1) |
| Q062 | N2-D-REF-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-ref-1-2) |
| Q063 | N2-D-REF-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-ref-1-3) |
| Q064 | N2-D-REF-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-ref-2-1) |
| Q065 | N2-D-REF-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-ref-2-2) |
| Q066 | N2-D-REF-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-ref-2-3) |
| Q067 | N2-D-RECOVERY-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-recovery-1-1) |
| Q068 | N2-D-RECOVERY-1-1 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-d-recovery-1-1) |
| Q069 | N2-D-RECOVERY-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-recovery-1-2) |
| Q070 | N2-D-RECOVERY-1-2 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-d-recovery-1-2) |
| Q071 | N2-D-RECOVERY-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-recovery-1-3) |
| Q072 | N2-D-RECOVERY-1-3 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-d-recovery-1-3) |
| Q073 | N2-D-RECOVERY-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-recovery-2-1) |
| Q074 | N2-D-RECOVERY-2-1 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-d-recovery-2-1) |
| Q075 | N2-D-RECOVERY-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-recovery-2-2) |
| Q076 | N2-D-RECOVERY-2-2 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-d-recovery-2-2) |
| Q077 | N2-D-RECOVERY-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-recovery-2-3) |
| Q078 | N2-D-RECOVERY-2-3 | referent_policy | Multi-turn reference | Entity ambiguity, Clarification policy | [mở card](review-cards.md#n2-d-recovery-2-3) |
| Q079 | N2-D-SWITCH-1-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-switch-1-1) |
| Q080 | N2-D-SWITCH-1-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-switch-1-2) |
| Q081 | N2-D-SWITCH-1-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-switch-1-3) |
| Q082 | N2-D-SWITCH-1-3 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-d-switch-1-3) |
| Q083 | N2-D-SWITCH-2-1 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-switch-2-1) |
| Q084 | N2-D-SWITCH-2-2 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-switch-2-2) |
| Q085 | N2-D-SWITCH-2-3 | dialogue_target | Current-turn intent vs accumulated state | Multi-turn reference | [mở card](review-cards.md#n2-d-switch-2-3) |
| Q086 | N2-D-SWITCH-2-3 | budget_operator | Entity ambiguity | Other | [mở card](review-cards.md#n2-d-switch-2-3) |
