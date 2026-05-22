"use client";
import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token") || "" : "";
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}
const C = {
  bg:"#f8f9fc", card:"#ffffff", primary:"#4f46e5", primary2:"#7c3aed",
  textMain:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  border:"rgba(0,0,0,0.08)", borderPrimary:"rgba(79,70,229,0.2)",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.08)",
};
const TEMP_COLORS: Record<string,string> = {S:"#dc2626",A:"#d97706",B:"#059669",C:"#0891b2",D:"#6b7280"};
const TEMP_LABELS: Record<string,string> = {S:"依存寸前",A:"高ロイヤル",B:"安定",C:"離脱兆候",D:"休眠"};
const INDUSTRY_LIST = [
  {id:"nightlife", label:"🌙 夜職"},
  {id:"retail",    label:"🏪 小売・飲食"},
  {id:"b2b",       label:"💼 法人営業・BtoB"},
  {id:"beauty",    label:"💆 美容・サロン"},
  {id:"fitness",   label:"🏋️ フィットネス・スクール"},
  {id:"realestate",label:"🏠 不動産"},
  {id:"other",     label:"🔷 その他"},
];

const INDUSTRY_FIELDS: Record<string, {
  basic: {label:string;k:keyof Customer;ph:string;type?:string}[];
  visit: {label:string;k:keyof Customer;ph:string;type?:string;textarea?:boolean}[];
  talk: {label:string;k:keyof Customer;ph:string}[];
  action: {label:string;k:keyof Customer;ph:string}[];
  danger: {label:string;k:keyof Customer;ph:string;textarea?:boolean}[];
}> = {
  nightlife: {
    basic: [
      {label:"顧客名*",k:"name",ph:"田中さん"},
      {label:"年齢",k:"age",ph:"28"},
      {label:"職業",k:"occupation",ph:"会社員"},
      {label:"居住地・エリア",k:"area",ph:"渋谷"},
      {label:"SNS",k:"sns",ph:"@handle"},
    ],
    visit: [
      {label:"初回来店日",k:"first_visit",ph:"",type:"date"},
      {label:"最終来店日",k:"last_visit",ph:"",type:"date"},
      {label:"来店回数",k:"visit_count",ph:"12"},
      {label:"来店周期（日）",k:"visit_cycle",ph:"14"},
      {label:"累計利用金額（円）",k:"spend_total",ph:"150000"},
      {label:"平均滞在時間（分）",k:"stay_time",ph:"90"},
      {label:"指名履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"オプション履歴",k:"option_history",ph:"VIPコース常連",textarea:true},
    ],
    talk: [
      {label:"趣味・好きなこと",k:"hobbies",ph:"釣り、ゲーム"},
      {label:"好む会話トピック",k:"good_topics",ph:"仕事の話、旅行"},
      {label:"NGトピック",k:"ng_topics",ph:"家族の話"},
      {label:"コンプレックス",k:"complex",ph:"身長、収入"},
      {label:"承認欲求傾向",k:"approval_tendency",ph:"高い・普通・低い"},
      {label:"疑似恋愛傾向",k:"pseudo_love_tendency",ph:"強い・普通・弱い"},
      {label:"性的傾向メモ",k:"sexual_tendency",ph:"特記事項のみ"},
      {label:"ストレス状態",k:"stress_state",ph:"仕事が多忙"},
    ],
    action: [
      {label:"LINE返信率（%）",k:"line_reply_rate",ph:"80"},
      {label:"LINE活発な時間帯",k:"line_active_time",ph:"22時〜24時"},
      {label:"既読速度",k:"read_speed",ph:"即既読・数時間後・翌日"},
      {label:"ドタキャン率（%）",k:"cancel_rate",ph:"10"},
      {label:"当日予約率（%）",k:"same_day_rate",ph:"30"},
      {label:"深夜反応率（%）",k:"late_night_rate",ph:"60"},
      {label:"SNS閲覧傾向",k:"sns_view_tendency",ph:"ストーリー毎回見る・投稿に反応"},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:"2024/3 過剰な要求でトラブル"},
      {label:"境界違反",k:"boundary_violation",ph:"プライベート連絡を要求"},
      {label:"執着傾向",k:"obsession_tendency",ph:"特定キャストへの強い執着"},
      {label:"攻撃性",k:"aggression",ph:"酔うと態度が変わる"},
      {label:"メンタル不安定",k:"mental_instability",ph:"感情の起伏が激しい"},
      {label:"地雷履歴",k:"landmine_history",ph:"〇〇という話題でキレた"},
    ],
  },
  retail: {
    basic: [
      {label:"顧客名*",k:"name",ph:"田中さん"},
      {label:"顧客ランク",k:"age",ph:"VIP・一般・新規"},
      {label:"主な購買カテゴリ",k:"occupation",ph:"ファッション・食品・雑貨"},
      {label:"購買動機",k:"area",ph:"価格重視・品質重視"},
      {label:"価格感度",k:"sns",ph:"高感度・中・低感度"},
    ],
    visit: [
      {label:"最終来店日",k:"last_visit",ph:"",type:"date"},
      {label:"初回来店日",k:"first_visit",ph:"",type:"date"},
      {label:"購入回数",k:"visit_count",ph:"8"},
      {label:"来店頻度（日）",k:"visit_cycle",ph:"30"},
      {label:"累計購入金額（円）",k:"spend_total",ph:"80000"},
      {label:"平均客単価（円）",k:"stay_time",ph:"10000"},
      {label:"担当スタッフ履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"返品履歴",k:"option_history",ph:"2024/3 返品1件",textarea:true},
    ],
    talk: [
      {label:"購買動機・好み",k:"hobbies",ph:"価格重視・ブランド志向"},
      {label:"好む接客スタイル",k:"good_topics",ph:"丁寧・距離感ある・提案型"},
      {label:"NGアプローチ",k:"ng_topics",ph:"押し売り・過度な声がけ"},
      {label:"関心カテゴリ",k:"complex",ph:"季節商品・限定品・セール"},
      {label:"購買頻度傾向",k:"approval_tendency",ph:"衝動買い多い・計画的"},
      {label:"口コミ発信傾向",k:"pseudo_love_tendency",ph:"SNS発信する・しない"},
      {label:"同伴者パターン",k:"sexual_tendency",ph:"一人・家族連れ・友人"},
      {label:"ストレス状態",k:"stress_state",ph:"特記事項"},
    ],
    action: [
      {label:"LINE/メール返信率（%）",k:"line_reply_rate",ph:"70"},
      {label:"来店しやすい時間帯",k:"line_active_time",ph:"土日午後・平日夜"},
      {label:"反応速度",k:"read_speed",ph:"即日・数日後"},
      {label:"予約キャンセル率（%）",k:"cancel_rate",ph:"5"},
      {label:"当日来店率（%）",k:"same_day_rate",ph:"40"},
      {label:"夜間問い合わせ率（%）",k:"late_night_rate",ph:"10"},
      {label:"SNS閲覧傾向",k:"sns_view_tendency",ph:"Instagram・LINE"},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:"返品トラブル・対応不満"},
      {label:"不当要求歴",k:"boundary_violation",ph:"値引き強要・無理な要求"},
      {label:"執着・こだわり傾向",k:"obsession_tendency",ph:"同じスタッフ指定"},
      {label:"攻撃性",k:"aggression",ph:"クレームをSNSで拡散"},
      {label:"メンタル不安定",k:"mental_instability",ph:"感情的になりやすい"},
      {label:"要注意履歴",k:"landmine_history",ph:"過去トラブル内容"},
    ],
  },
  b2b: {
    basic: [
      {label:"会社名*",k:"name",ph:"株式会社〇〇"},
      {label:"担当者名",k:"age",ph:"山田太郎"},
      {label:"役職",k:"occupation",ph:"部長・課長・担当"},
      {label:"決裁権限",k:"area",ph:"決裁者・担当・インフルエンサー"},
      {label:"企業規模",k:"sns",ph:"大手・中堅・中小・スタートアップ"},
    ],
    visit: [
      {label:"最終接触日",k:"last_visit",ph:"",type:"date"},
      {label:"初回接触日",k:"first_visit",ph:"",type:"date"},
      {label:"商談回数",k:"visit_count",ph:"5"},
      {label:"商談周期（日）",k:"visit_cycle",ph:"14"},
      {label:"累計受注金額（円）",k:"spend_total",ph:"500000"},
      {label:"平均商談時間（分）",k:"stay_time",ph:"60"},
      {label:"担当者履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"案件ステージ",k:"option_history",ph:"情報収集→比較→決裁待ち",textarea:true},
    ],
    talk: [
      {label:"関心課題・ニーズ",k:"hobbies",ph:"コスト削減・DX推進"},
      {label:"好む商談スタイル",k:"good_topics",ph:"データ重視・事例紹介"},
      {label:"NGアプローチ",k:"ng_topics",ph:"感情論・曖昧な提案"},
      {label:"決裁権限",k:"complex",ph:"決裁者・担当者・インフルエンサー"},
      {label:"社内影響力",k:"approval_tendency",ph:"高・中・低"},
      {label:"競合接触状況",k:"pseudo_love_tendency",ph:"他社と比較検討中"},
      {label:"予算規模感",k:"sexual_tendency",ph:"〜50万・〜300万・それ以上"},
      {label:"検討フェーズ",k:"stress_state",ph:"情報収集・比較・決裁待ち"},
    ],
    action: [
      {label:"メール返信率（%）",k:"line_reply_rate",ph:"60"},
      {label:"連絡しやすい時間帯",k:"line_active_time",ph:"平日10〜12時"},
      {label:"返信速度",k:"read_speed",ph:"即日・数日後・週単位"},
      {label:"アポキャンセル率（%）",k:"cancel_rate",ph:"15"},
      {label:"即決率（%）",k:"same_day_rate",ph:"20"},
      {label:"夜間対応可否（%）",k:"late_night_rate",ph:"5"},
      {label:"情報収集媒体",k:"sns_view_tendency",ph:"LinkedIn・業界メディア"},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:"納期遅延でトラブル"},
      {label:"契約違反・要求逸脱",k:"boundary_violation",ph:"契約外要求・過剰値引き要求"},
      {label:"競合流出リスク",k:"obsession_tendency",ph:"他社への乗り換え検討中"},
      {label:"社内政治リスク",k:"aggression",ph:"担当者と上長で意見対立"},
      {label:"財務リスク",k:"mental_instability",ph:"支払い遅延歴あり"},
      {label:"要注意履歴",k:"landmine_history",ph:"過去トラブル内容"},
    ],
  },
  beauty: {
    basic: [
      {label:"顧客名*",k:"name",ph:"田中さん"},
      {label:"悩み・コンプレックス",k:"age",ph:"乾燥肌・くすみ"},
      {label:"希望メニュー",k:"occupation",ph:"フェイシャル・カラー"},
      {label:"アレルギー・禁忌",k:"area",ph:"特定成分アレルギーなし"},
      {label:"指名傾向",k:"sns",ph:"指名あり・フリー"},
    ],
    visit: [
      {label:"最終来店日",k:"last_visit",ph:"",type:"date"},
      {label:"初回来店日",k:"first_visit",ph:"",type:"date"},
      {label:"施術回数",k:"visit_count",ph:"10"},
      {label:"来店周期（日）",k:"visit_cycle",ph:"30"},
      {label:"累計利用金額（円）",k:"spend_total",ph:"120000"},
      {label:"平均施術時間（分）",k:"stay_time",ph:"90"},
      {label:"担当施術者履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"物販購入履歴",k:"option_history",ph:"美容液・トリートメント",textarea:true},
    ],
    talk: [
      {label:"悩み・コンプレックス",k:"hobbies",ph:"乾燥肌・くすみ・髪質"},
      {label:"好む施術・メニュー",k:"good_topics",ph:"リラクゼーション重視・仕上がり重視"},
      {label:"NGアプローチ",k:"ng_topics",ph:"過度なアップセル・長時間説明"},
      {label:"ライフスタイル",k:"complex",ph:"仕事多忙・育児中"},
      {label:"美容感度",k:"approval_tendency",ph:"高い・普通・低い"},
      {label:"SNS発信傾向",k:"pseudo_love_tendency",ph:"ビフォーアフター投稿する"},
      {label:"来店目的",k:"sexual_tendency",ph:"リフレッシュ・特別ケア・記念日"},
      {label:"ストレス状態",k:"stress_state",ph:"疲れ気味・元気"},
    ],
    action: [
      {label:"LINE返信率（%）",k:"line_reply_rate",ph:"75"},
      {label:"来店しやすい時間帯",k:"line_active_time",ph:"土日午前・平日夕方"},
      {label:"返信速度",k:"read_speed",ph:"即日・翌日"},
      {label:"予約キャンセル率（%）",k:"cancel_rate",ph:"8"},
      {label:"当日予約率（%）",k:"same_day_rate",ph:"20"},
      {label:"夜間連絡反応（%）",k:"late_night_rate",ph:"15"},
      {label:"SNS閲覧傾向",k:"sns_view_tendency",ph:"Instagram・TikTok"},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:"仕上がり不満・返金要求"},
      {label:"過剰要求",k:"boundary_violation",ph:"施術範囲外の要求"},
      {label:"執着・指名こだわり",k:"obsession_tendency",ph:"特定スタッフ以外拒否"},
      {label:"攻撃性",k:"aggression",ph:"SNSで悪評を書く"},
      {label:"アレルギー・禁忌",k:"mental_instability",ph:"特定成分アレルギー"},
      {label:"要注意履歴",k:"landmine_history",ph:"過去トラブル内容"},
    ],
  },
  fitness: {
    basic: [
      {label:"会員名*",k:"name",ph:"田中さん"},
      {label:"目標",k:"age",ph:"ダイエット・筋力UP"},
      {label:"現在レベル",k:"occupation",ph:"初心者・中級者・上級者"},
      {label:"継続目的",k:"area",ph:"健康維持・体型改善・競技"},
      {label:"既往歴・怪我注意",k:"sns",ph:"膝痛・腰椎注意"},
    ],
    visit: [
      {label:"最終来館日",k:"last_visit",ph:"",type:"date"},
      {label:"初回来館日",k:"first_visit",ph:"",type:"date"},
      {label:"セッション回数",k:"visit_count",ph:"20"},
      {label:"来館周期（日）",k:"visit_cycle",ph:"7"},
      {label:"累計利用金額（円）",k:"spend_total",ph:"100000"},
      {label:"平均利用時間（分）",k:"stay_time",ph:"60"},
      {label:"担当トレーナー履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"契約プラン・更新履歴",k:"option_history",ph:"月額10回コース",textarea:true},
    ],
    talk: [
      {label:"目標・悩み",k:"hobbies",ph:"ダイエット・筋力UP・健康維持"},
      {label:"好む指導スタイル",k:"good_topics",ph:"褒めて伸ばす・厳しく鍛える"},
      {label:"NGアプローチ",k:"ng_topics",ph:"過度なプッシュ・比較"},
      {label:"運動歴・レベル",k:"complex",ph:"初心者・経験者・アスリート"},
      {label:"モチベーション傾向",k:"approval_tendency",ph:"外発的・内発的"},
      {label:"継続意欲",k:"pseudo_love_tendency",ph:"高い・波がある・低い"},
      {label:"食事・生活習慣",k:"sexual_tendency",ph:"食事管理できている・不規則"},
      {label:"ストレス状態",k:"stress_state",ph:"仕事多忙・体調不良"},
    ],
    action: [
      {label:"連絡返信率（%）",k:"line_reply_rate",ph:"80"},
      {label:"来館しやすい時間帯",k:"line_active_time",ph:"朝6〜8時・夜20〜22時"},
      {label:"返信速度",k:"read_speed",ph:"即日・翌日"},
      {label:"欠席率（%）",k:"cancel_rate",ph:"20"},
      {label:"当日予約率（%）",k:"same_day_rate",ph:"30"},
      {label:"夜間連絡反応（%）",k:"late_night_rate",ph:"10"},
      {label:"SNS閲覧傾向",k:"sns_view_tendency",ph:"Instagram・YouTube"},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:"指導方法への不満"},
      {label:"過剰要求",k:"boundary_violation",ph:"営業時間外の連絡要求"},
      {label:"依存傾向",k:"obsession_tendency",ph:"特定トレーナー依存"},
      {label:"攻撃性",k:"aggression",ph:"他会員とトラブル"},
      {label:"健康上の注意",k:"mental_instability",ph:"持病・怪我・医師制限"},
      {label:"要注意履歴",k:"landmine_history",ph:"過去トラブル内容"},
    ],
  },
  realestate: {
    basic: [
      {label:"顧客名*",k:"name",ph:"田中さん"},
      {label:"希望エリア",k:"age",ph:"渋谷・新宿・横浜"},
      {label:"予算",k:"occupation",ph:"3000万・家賃10万"},
      {label:"賃貸・購入",k:"area",ph:"賃貸・購入・売却"},
      {label:"入居・購入希望時期",k:"sns",ph:"3ヶ月以内・半年以内"},
    ],
    visit: [
      {label:"最終接触日",k:"last_visit",ph:"",type:"date"},
      {label:"初回接触日",k:"first_visit",ph:"",type:"date"},
      {label:"内見回数",k:"visit_count",ph:"3"},
      {label:"接触周期（日）",k:"visit_cycle",ph:"7"},
      {label:"想定成約金額（円）",k:"spend_total",ph:"30000000"},
      {label:"平均商談時間（分）",k:"stay_time",ph:"60"},
      {label:"担当者履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"内見物件履歴",k:"option_history",ph:"〇〇マンション・△△ハウス",textarea:true},
    ],
    talk: [
      {label:"希望条件・ニーズ",k:"hobbies",ph:"駅近・広さ・学区・予算"},
      {label:"好む提案スタイル",k:"good_topics",ph:"データ重視・現地案内重視"},
      {label:"NGアプローチ",k:"ng_topics",ph:"急かす・過度なプッシュ"},
      {label:"検討状況",k:"complex",ph:"物件探し中・売却検討・投資目的"},
      {label:"意思決定者",k:"approval_tendency",ph:"本人・配偶者も関与・親"},
      {label:"競合接触状況",k:"pseudo_love_tendency",ph:"他社も並行検討中"},
      {label:"資金計画",k:"sexual_tendency",ph:"ローン検討中・現金・要確認"},
      {label:"検討期間感",k:"stress_state",ph:"急いでいる・ゆっくり探す"},
    ],
    action: [
      {label:"返信率（%）",k:"line_reply_rate",ph:"65"},
      {label:"連絡しやすい時間帯",k:"line_active_time",ph:"土日・平日夜"},
      {label:"返信速度",k:"read_speed",ph:"即日・数日後"},
      {label:"内見キャンセル率（%）",k:"cancel_rate",ph:"20"},
      {label:"即決率（%）",k:"same_day_rate",ph:"10"},
      {label:"夜間連絡反応（%）",k:"late_night_rate",ph:"20"},
      {label:"情報収集媒体",k:"sns_view_tendency",ph:"SUUMO・SNS・知人紹介"},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:"説明不足・契約後のトラブル"},
      {label:"不当要求",k:"boundary_violation",ph:"値引き強要・無理な条件"},
      {label:"他社との二重交渉",k:"obsession_tendency",ph:"複数社と同時進行"},
      {label:"攻撃性",k:"aggression",ph:"SNSで悪評・クレーム常習"},
      {label:"財務リスク",k:"mental_instability",ph:"ローン審査懸念・支払能力"},
      {label:"要注意履歴",k:"landmine_history",ph:"過去トラブル内容"},
    ],
  },
  other: {
    basic: [
      {label:"顧客名*",k:"name",ph:"田中さん"},
      {label:"属性1",k:"age",ph:""},
      {label:"属性2",k:"occupation",ph:""},
      {label:"エリア",k:"area",ph:""},
      {label:"連絡先・SNS",k:"sns",ph:""},
    ],
    visit: [
      {label:"最終接触日",k:"last_visit",ph:"",type:"date"},
      {label:"初回接触日",k:"first_visit",ph:"",type:"date"},
      {label:"利用回数",k:"visit_count",ph:"5"},
      {label:"接触周期（日）",k:"visit_cycle",ph:"30"},
      {label:"累計金額（円）",k:"spend_total",ph:"50000"},
      {label:"平均対応時間（分）",k:"stay_time",ph:"60"},
      {label:"担当者履歴",k:"nomination_history",ph:"",textarea:true},
      {label:"利用サービス履歴",k:"option_history",ph:"",textarea:true},
    ],
    talk: [
      {label:"趣味・関心",k:"hobbies",ph:""},
      {label:"好むアプローチ",k:"good_topics",ph:""},
      {label:"NGアプローチ",k:"ng_topics",ph:""},
      {label:"特記事項1",k:"complex",ph:""},
      {label:"傾向1",k:"approval_tendency",ph:""},
      {label:"傾向2",k:"pseudo_love_tendency",ph:""},
      {label:"傾向3",k:"sexual_tendency",ph:""},
      {label:"ストレス状態",k:"stress_state",ph:""},
    ],
    action: [
      {label:"連絡返信率（%）",k:"line_reply_rate",ph:""},
      {label:"連絡しやすい時間帯",k:"line_active_time",ph:""},
      {label:"返信速度",k:"read_speed",ph:""},
      {label:"キャンセル率（%）",k:"cancel_rate",ph:""},
      {label:"当日対応率（%）",k:"same_day_rate",ph:""},
      {label:"夜間反応率（%）",k:"late_night_rate",ph:""},
      {label:"情報収集媒体",k:"sns_view_tendency",ph:""},
    ],
    danger: [
      {label:"クレーム歴",k:"claim_history",ph:""},
      {label:"過剰要求",k:"boundary_violation",ph:""},
      {label:"執着傾向",k:"obsession_tendency",ph:""},
      {label:"攻撃性",k:"aggression",ph:""},
      {label:"その他リスク",k:"mental_instability",ph:""},
      {label:"要注意履歴",k:"landmine_history",ph:""},
    ],
  },
};

const INDUSTRY_META: Record<string,{
  staffNoun: string;
  staffIcon: string;
  castHeader: string;
  castSub: string;
  castEnLabel: string;
  feedbackLabel: string;
  eventLabel: string;
  visitLabel: string;
  cycleLabel: string;
  spendLabel: string;
  nominationLabel: string;
  optionLabel: string;
  stayLabel: string;
  ragDesc: string;
  ragTypes: Record<string,{label:string;icon:string;color:string;desc:string}>;
  eventCategories: Record<string,{types:string[];icon:string;color:string}>;
  inferencePresets: string[];
  feedbackActions: string[];
}> = {
  nightlife: {
    staffNoun:"キャスト", staffIcon:"💃",
    castHeader:"キャスト相性学習", castSub:"顧客×キャストの最適組み合わせをAIが解析します",
    castEnLabel:"CAST AFFINITY LEARNING",
    feedbackLabel:"💃相性", eventLabel:"⚡イベント",
    visitLabel:"来店", cycleLabel:"来店周期（日）", spendLabel:"累計利用金額（円）",
    nominationLabel:"指名履歴", optionLabel:"オプション履歴", stayLabel:"平均滞在時間（分）",
    ragDesc:"接客ノウハウ・危険対応・店舗ルールをAIに学習させます",
    ragTypes:{
      service_rag:{label:"接客ノウハウ",icon:"✨",color:"#4f46e5",desc:"売れる接客・成功パターン・会話術"},
      risk_rag:{label:"危険対応",icon:"⚠️",color:"#dc2626",desc:"クレーム対応・境界違反・危険パターン"},
      store_rag:{label:"店舗ルール",icon:"🏪",color:"#059669",desc:"営業ルール・禁止事項・特記事項"},
      cast_rag:{label:"キャスト傾向",icon:"💃",color:"#d97706",desc:"各キャストの特徴・得意不得意"},
      customer_rag:{label:"顧客過去情報",icon:"👤",color:"#0891b2",desc:"過去の会話・反応・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["LINE送信","LINE返信","LINE未返信（24h）","電話不在","ブロック"],icon:"💬",color:"#059669"},
      "来店":{types:["来店完了","指名あり","フリー来店","キャンセル","再来店確認"],icon:"🏪",color:"#4f46e5"},
      "接客":{types:["オプション購入","延長あり","指名変更","感情依存傾向","深夜返信増加"],icon:"✨",color:"#d97706"},
      "リスク":{types:["比較発言あり","クレーム発生","7日間接触なし","境界違反","要注意行動"],icon:"⚠️",color:"#dc2626"},
      "その他":{types:["メモ","紹介","誕生日対応"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["来店完了","LINE未返信（48h以上）","指名変更","キャンセル発生","深夜返信増加","オプション購入","7日間接触なし","クレーム発生"],
    feedbackActions:["来店促進LINE","指名促進","オプション提案","フォロー連絡","誕生日オファー","VIP対応","放置","その他"],
  },
  retail: {
    staffNoun:"スタッフ", staffIcon:"🏪",
    castHeader:"スタッフ相性学習", castSub:"顧客×スタッフの最適組み合わせをAIが解析します",
    castEnLabel:"STAFF AFFINITY LEARNING",
    feedbackLabel:"🔄学習", eventLabel:"⚡イベント",
    visitLabel:"来店", cycleLabel:"来店周期（日）", spendLabel:"累計購入金額（円）",
    nominationLabel:"担当スタッフ履歴", optionLabel:"購入カテゴリ履歴", stayLabel:"平均滞在時間（分）",
    ragDesc:"接客ノウハウ・商品知識・クレーム対応をAIに学習させます",
    ragTypes:{
      service_rag:{label:"接客ノウハウ",icon:"✨",color:"#4f46e5",desc:"売れる接客・成功パターン"},
      risk_rag:{label:"クレーム対応",icon:"⚠️",color:"#dc2626",desc:"クレーム対応・危険パターン"},
      store_rag:{label:"店舗ルール",icon:"🏪",color:"#059669",desc:"営業ルール・禁止事項"},
      cast_rag:{label:"スタッフ傾向",icon:"👤",color:"#d97706",desc:"各スタッフの特徴・得意分野"},
      customer_rag:{label:"顧客過去情報",icon:"👥",color:"#0891b2",desc:"過去の購入・反応・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["DM送信","メルマガ開封","SNS反応","問い合わせ"],icon:"💬",color:"#059669"},
      "来店":{types:["来店あり","購入完了","返品発生","長期未来店（30日以上）"],icon:"🏪",color:"#4f46e5"},
      "反応":{types:["セール反応あり","クーポン利用","高額購入","リピート確認"],icon:"📋",color:"#d97706"},
      "リスク":{types:["クレーム発生","返品多発","SNS否定的投稿","長期未来店（60日以上）"],icon:"⚠️",color:"#dc2626"},
      "その他":{types:["メモ","口コミ投稿","紹介"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["来店完了","長期未来店（30日以上）","クレーム発生","高額購入","セール反応","返品発生","リピート確認","紹介発生"],
    feedbackActions:["来店促進DM","商品提案","クーポン送付","セール案内","VIP対応","フォローアップ","放置","その他"],
  },
  b2b: {
    staffNoun:"担当営業", staffIcon:"💼",
    castHeader:"担当営業相性学習", castSub:"顧客×担当営業の最適組み合わせをAIが解析します",
    castEnLabel:"SALES AFFINITY LEARNING",
    feedbackLabel:"🔄学習", eventLabel:"⚡イベント",
    visitLabel:"訪問・商談", cycleLabel:"接触周期（日）", spendLabel:"累計契約金額（円）",
    nominationLabel:"担当営業履歴", optionLabel:"利用サービス履歴", stayLabel:"平均商談時間（分）",
    ragDesc:"営業ノウハウ・提案事例・クレーム対応をAIに学習させます",
    ragTypes:{
      service_rag:{label:"営業ノウハウ",icon:"✨",color:"#4f46e5",desc:"成約パターン・提案術"},
      risk_rag:{label:"リスク対応",icon:"⚠️",color:"#dc2626",desc:"クレーム対応・失注パターン"},
      store_rag:{label:"業務ルール",icon:"🏢",color:"#059669",desc:"社内ルール・禁止事項"},
      cast_rag:{label:"担当者傾向",icon:"💼",color:"#d97706",desc:"各担当者の特徴・得意分野"},
      customer_rag:{label:"顧客過去情報",icon:"👥",color:"#0891b2",desc:"過去の商談・反応・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["メール送信","電話発信","返信あり","未返信（48h）"],icon:"💬",color:"#059669"},
      "商談":{types:["初回訪問","提案実施","見積送付","条件交渉","他社比較"],icon:"📋",color:"#4f46e5"},
      "成約":{types:["申込","契約締結","追加発注","継続契約"],icon:"💰",color:"#059669"},
      "リスク":{types:["クレーム発生","失注","解約相談","長期放置（30日以上）"],icon:"⚠️",color:"#dc2626"},
      "その他":{types:["メモ","紹介","資料送付"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["初回訪問完了","長期放置（14日以上）","他社比較中","申込完了","クレーム発生","解約相談","継続更新","紹介発生"],
    feedbackActions:["フォロー連絡","提案資料送付","訪問促進","契約促進","情報提供","放置","その他"],
  },
  beauty: {
    staffNoun:"スタイリスト", staffIcon:"💆",
    castHeader:"スタイリスト相性学習", castSub:"顧客×スタイリストの最適組み合わせをAIが解析します",
    castEnLabel:"STYLIST AFFINITY LEARNING",
    feedbackLabel:"🔄学習", eventLabel:"⚡イベント",
    visitLabel:"来店", cycleLabel:"来店周期（日）", spendLabel:"累計利用金額（円）",
    nominationLabel:"指名スタイリスト履歴", optionLabel:"施術メニュー履歴", stayLabel:"平均施術時間（分）",
    ragDesc:"接客ノウハウ・施術事例・クレーム対応をAIに学習させます",
    ragTypes:{
      service_rag:{label:"接客ノウハウ",icon:"✨",color:"#4f46e5",desc:"リピート接客・成功パターン"},
      risk_rag:{label:"クレーム対応",icon:"⚠️",color:"#dc2626",desc:"クレーム対応・危険パターン"},
      store_rag:{label:"サロンルール",icon:"💆",color:"#059669",desc:"営業ルール・禁止事項"},
      cast_rag:{label:"スタイリスト傾向",icon:"💆",color:"#d97706",desc:"各スタイリストの特徴・得意分野"},
      customer_rag:{label:"顧客過去情報",icon:"👤",color:"#0891b2",desc:"過去の施術・反応・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["LINE送信","返信あり","未返信（48h）","リマインド送信"],icon:"💬",color:"#059669"},
      "来店":{types:["来店完了","予約変更","キャンセル","長期未来店（60日以上）"],icon:"💆",color:"#4f46e5"},
      "施術":{types:["物販購入","新メニュー提案","指名変更","口コミ投稿"],icon:"✨",color:"#d97706"},
      "リスク":{types:["クレーム発生","SNS否定的投稿","指名なし化","要注意行動"],icon:"⚠️",color:"#dc2626"},
      "その他":{types:["メモ","紹介","誕生日対応"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["来店完了","キャンセル発生","長期未来店（60日以上）","物販購入","クレーム発生","指名変更","口コミ投稿","紹介発生"],
    feedbackActions:["来店促進LINE","クーポン送付","新メニュー案内","誕生日オファー","VIP対応","フォロー","放置","その他"],
  },
  fitness: {
    staffNoun:"トレーナー", staffIcon:"🏋️",
    castHeader:"トレーナー相性学習", castSub:"会員×トレーナーの最適組み合わせをAIが解析します",
    castEnLabel:"TRAINER AFFINITY LEARNING",
    feedbackLabel:"🔄学習", eventLabel:"⚡イベント",
    visitLabel:"来館", cycleLabel:"来館周期（日）", spendLabel:"累計利用金額（円）",
    nominationLabel:"担当トレーナー履歴", optionLabel:"利用プログラム履歴", stayLabel:"平均利用時間（分）",
    ragDesc:"トレーニング指導・会員対応・退会防止をAIに学習させます",
    ragTypes:{
      service_rag:{label:"指導ノウハウ",icon:"✨",color:"#4f46e5",desc:"継続支援・成功パターン"},
      risk_rag:{label:"退会リスク対応",icon:"⚠️",color:"#dc2626",desc:"退会防止・クレーム対応"},
      store_rag:{label:"施設ルール",icon:"🏋️",color:"#059669",desc:"営業ルール・禁止事項"},
      cast_rag:{label:"トレーナー傾向",icon:"🏋️",color:"#d97706",desc:"各トレーナーの特徴・得意分野"},
      customer_rag:{label:"会員過去情報",icon:"👤",color:"#0891b2",desc:"過去の来館・目標・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["アプリ通知","LINE送信","返信あり","未返信（72h）"],icon:"💬",color:"#059669"},
      "来館":{types:["来館あり","長期未来館（14日以上）","体験参加","キャンセル"],icon:"🏋️",color:"#4f46e5"},
      "進捗":{types:["目標達成","記録更新","プログラム変更","退会相談"],icon:"📋",color:"#d97706"},
      "リスク":{types:["クレーム発生","長期未来館（30日以上）","退会申請","モチベーション低下"],icon:"⚠️",color:"#dc2626"},
      "その他":{types:["メモ","紹介","誕生日対応"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["来館完了","長期未来館（14日以上）","退会相談","目標達成","クレーム発生","プログラム変更","紹介発生","入会促進"],
    feedbackActions:["来館促進連絡","プログラム提案","目標設定面談","退会防止フォロー","特典案内","放置","その他"],
  },
  realestate: {
    staffNoun:"担当営業", staffIcon:"🏠",
    castHeader:"担当営業相性学習", castSub:"顧客×担当営業の最適組み合わせをAIが解析します",
    castEnLabel:"AGENT AFFINITY LEARNING",
    feedbackLabel:"🔄学習", eventLabel:"⚡イベント",
    visitLabel:"来店・訪問", cycleLabel:"接触周期（日）", spendLabel:"成約金額（円）",
    nominationLabel:"担当営業履歴", optionLabel:"検討物件履歴", stayLabel:"平均商談時間（分）",
    ragDesc:"営業ノウハウ・物件情報・クレーム対応をAIに学習させます",
    ragTypes:{
      service_rag:{label:"営業ノウハウ",icon:"✨",color:"#4f46e5",desc:"成約パターン・内見術"},
      risk_rag:{label:"リスク対応",icon:"⚠️",color:"#dc2626",desc:"クレーム対応・審査落ち対応"},
      store_rag:{label:"業務ルール",icon:"🏢",color:"#059669",desc:"社内ルール・禁止事項"},
      cast_rag:{label:"担当者傾向",icon:"🏠",color:"#d97706",desc:"各担当者の特徴・得意エリア"},
      customer_rag:{label:"顧客過去情報",icon:"👥",color:"#0891b2",desc:"過去の商談・反応・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["メール送信","電話発信","返信あり","未返信（48h）"],icon:"💬",color:"#059669"},
      "内見":{types:["内見予約","内見実施","再内見","キャンセル"],icon:"🏠",color:"#4f46e5"},
      "商談":{types:["申込","審査中","契約締結","条件交渉","他社比較"],icon:"📋",color:"#d97706"},
      "リスク":{types:["審査落ち","長期放置（14日以上）","他社成約","予算不一致"],icon:"⚠️",color:"#dc2626"},
      "その他":{types:["メモ","紹介","資料送付"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["内見完了","長期放置（14日以上）","他社成約","申込完了","価格交渉開始","ローン審査中","キャンセル発生","紹介発生"],
    feedbackActions:["新着物件紹介","フォロー電話","資料送付","内見促進","契約促進","情報提供","放置","その他"],
  },
  other: {
    staffNoun:"担当者", staffIcon:"👤",
    castHeader:"担当者相性学習", castSub:"顧客×担当者の最適組み合わせをAIが解析します",
    castEnLabel:"STAFF AFFINITY LEARNING",
    feedbackLabel:"🔄学習", eventLabel:"⚡イベント",
    visitLabel:"来店・訪問", cycleLabel:"接触周期（日）", spendLabel:"累計金額（円）",
    nominationLabel:"担当者履歴", optionLabel:"利用サービス履歴", stayLabel:"平均対応時間（分）",
    ragDesc:"業務ノウハウ・対応事例・ルールをAIに学習させます",
    ragTypes:{
      service_rag:{label:"業務ノウハウ",icon:"✨",color:"#4f46e5",desc:"成功パターン・対応術"},
      risk_rag:{label:"リスク対応",icon:"⚠️",color:"#dc2626",desc:"クレーム対応・危険パターン"},
      store_rag:{label:"業務ルール",icon:"🏢",color:"#059669",desc:"営業ルール・禁止事項・特記事項"},
      cast_rag:{label:"担当者傾向",icon:"👤",color:"#d97706",desc:"各担当者の特徴・得意分野"},
      customer_rag:{label:"顧客過去情報",icon:"👥",color:"#0891b2",desc:"過去の履歴・反応・特記事項"},
    },
    eventCategories:{
      "連絡":{types:["送信","返信","未返信","ブロック"],icon:"💬",color:"#059669"},
      "利用":{types:["予約","利用","キャンセル","継続","離脱"],icon:"🏢",color:"#4f46e5"},
      "反応":{types:["好反応","クレーム","比較検討","要注意"],icon:"📋",color:"#d97706"},
      "売上":{types:["購入","高額利用","継続契約","解約相談"],icon:"💰",color:"#8b5cf6"},
      "その他":{types:["メモ","紹介"],icon:"📝",color:"#6b7280"},
    },
    inferencePresets:["対応完了","長期放置","クレーム発生","成約","離脱リスク","再接触","紹介発生","その他"],
    feedbackActions:["フォロー連絡","案内送付","提案","対応","放置","その他"],
  },
};

const PSYCH_TYPES = ["承認型","癒し型","疑似恋愛型","孤独回避型","支配型","会話型","性優先型","比較検討型","自尊回復型","ストレス逃避型"];
const DESIRE_TYPES = ["承認不足","癒し不足","独占欲増加","飽き","比較中","疲労蓄積","依存進行","距離不安","刺激不足"];

const INDUSTRY_AI_SCHEMA: Record<string,{
  tempLabel:string; tempDesc:string;
  psychLabel:string; psychDesc:string;
  desireLabel:string; desireDesc:string;
  churnLabel:string; churnDesc:string;
}> = {
  nightlife: {
    tempLabel:"顧客温度", tempDesc:"S:依存寸前 / A:高ロイヤル / B:安定 / C:離脱兆候 / D:休眠",
    psychLabel:"心理タイプ", psychDesc:"顧客の主な心理・行動傾向を選択",
    desireLabel:"現在欲求", desireDesc:"今この顧客が最も求めているものを選択",
    churnLabel:"離脱危険度", churnDesc:"高：緊急フォロー必要 / 中：要注意 / 低：安定",
  },
  retail: {
    tempLabel:"購買温度", tempDesc:"S:リピート確実 / A:高関心 / B:安定 / C:休眠兆候 / D:休眠",
    psychLabel:"購買タイプ", psychDesc:"衝動型・計画型・比較型・ブランド型・節約型",
    desireLabel:"現在ニーズ", desireDesc:"今この顧客が最も求めているものを選択",
    churnLabel:"休眠危険度", churnDesc:"高：緊急アプローチ必要 / 中：要注意 / 低：安定",
  },
  b2b: {
    tempLabel:"案件温度", tempDesc:"S:契約直前 / A:高確度 / B:検討中 / C:停滞 / D:休眠",
    psychLabel:"意思決定タイプ", psychDesc:"分析型・直感型・合意型・権威型・回避型",
    desireLabel:"現在フェーズ", desireDesc:"情報収集・比較検討・稟議中・決裁待ち・保留",
    churnLabel:"失注危険度", churnDesc:"高：緊急対応必要 / 中：要注意 / 低：安定",
  },
  beauty: {
    tempLabel:"来店温度", tempDesc:"S:指名固定 / A:高ロイヤル / B:安定 / C:離脱兆候 / D:休眠",
    psychLabel:"美容ニーズタイプ", psychDesc:"リラクゼーション型・美容意識型・SNS型・記念日型・習慣型",
    desireLabel:"現在悩み", desireDesc:"今この顧客が最も気にしている悩みを選択",
    churnLabel:"離脱危険度", churnDesc:"高：緊急フォロー必要 / 中：要注意 / 低：安定",
  },
  fitness: {
    tempLabel:"継続温度", tempDesc:"S:目標達成中 / A:高モチベ / B:安定 / C:停滞 / D:欠席増加",
    psychLabel:"モチベーションタイプ", psychDesc:"目標型・習慣型・社交型・健康維持型・外見型",
    desireLabel:"現在課題", desireDesc:"今この会員が抱えている主な課題を選択",
    churnLabel:"退会危険度", churnDesc:"高：緊急介入必要 / 中：要注意 / 低：安定",
  },
  realestate: {
    tempLabel:"成約温度", tempDesc:"S:契約直前 / A:高確度 / B:検討中 / C:停滞 / D:休眠",
    psychLabel:"検討タイプ", psychDesc:"即決型・比較型・慎重型・条件重視型・予算優先型",
    desireLabel:"現在条件", desireDesc:"今この顧客が最優先している条件を選択",
    churnLabel:"失注危険度", churnDesc:"高：緊急対応必要 / 中：要注意 / 低：安定",
  },
  other: {
    tempLabel:"顧客温度", tempDesc:"S:最高 / A:高 / B:安定 / C:低下 / D:休眠",
    psychLabel:"顧客タイプ", psychDesc:"顧客の主な傾向を選択",
    desireLabel:"現在ニーズ", desireDesc:"今この顧客が求めているものを選択",
    churnLabel:"離脱危険度", churnDesc:"高：要対応 / 中：要注意 / 低：安定",
  },
};

const INDUSTRY_TRIGGER_PRESETS: Record<string,string[]> = {
  nightlife: ["LINE返信あり","LINE未返信（24時間以上）","来店完了","キャンセル発生","深夜返信増加","オプション購入","比較発言あり","感情依存傾向","7日間接触なし","指名変更","クレーム発生","再来店確認"],
  retail: ["来店あり","長期未来店（30日以上）","購入完了","返品発生","クレーム発生","セール反応あり","メルマガ開封","問い合わせあり","SNS反応あり","リピート確認"],
  b2b: ["メール返信あり","商談完了","提案書送付","見積依頼あり","稟議通過","失注確定","担当者変更","競合接触確認","契約締結","追加発注"],
  beauty: ["来店完了","キャンセル発生","予約変更","物販購入","SNS反応あり","口コミ投稿","指名変更","クレーム発生","長期未来店（60日以上）","再来店確認"],
  fitness: ["来館あり","欠席発生","目標達成","怪我発生","モチベ低下サイン","プログラム変更","退会相談","継続更新","食事報告あり","紹介発生"],
  realestate: ["内見完了","申込完了","価格交渉開始","ローン審査中","他社成約","キャンセル発生","長期放置（14日以上）","条件変更","紹介発生","契約締結"],
  other: ["対応完了","長期放置","クレーム発生","成約","離脱リスク","再接触","紹介発生","その他"],
};

type Customer = {
  id?: string;
  // 基本
  industry: string;
  name: string; age: string; occupation: string; area: string; sns: string; line_yn: boolean;
  // 来店
  first_visit: string; last_visit: string; visit_count: string; visit_cycle: string;
  spend_total: string; nomination_history: string; option_history: string; stay_time: string;
  // 会話
  hobbies: string; good_topics: string; ng_topics: string; complex: string;
  approval_tendency: string; pseudo_love_tendency: string; sexual_tendency: string; stress_state: string;
  // 行動
  line_reply_rate: string; line_active_time: string; read_speed: string;
  cancel_rate: string; same_day_rate: string; late_night_rate: string; sns_view_tendency: string;
  // 危険情報
  claim_history: string; boundary_violation: string; obsession_tendency: string;
  aggression: string; mental_instability: string; landmine_history: string;
  // AI推論
  temp: string; psych_type: string; current_desire: string; churn_risk: string; notes: string;
};

const EMPTY_CUSTOMER: Customer = {
  industry:"nightlife",
  name:"", age:"", occupation:"", area:"", sns:"", line_yn:false,
  first_visit:"", last_visit:"", visit_count:"", visit_cycle:"",
  spend_total:"", nomination_history:"", option_history:"", stay_time:"",
  hobbies:"", good_topics:"", ng_topics:"", complex:"",
  approval_tendency:"", pseudo_love_tendency:"", sexual_tendency:"", stress_state:"",
  line_reply_rate:"", line_active_time:"", read_speed:"",
  cancel_rate:"", same_day_rate:"", late_night_rate:"", sns_view_tendency:"",
  claim_history:"", boundary_violation:"", obsession_tendency:"",
  aggression:"", mental_instability:"", landmine_history:"",
  temp:"B", psych_type:"承認型", current_desire:"承認不足", churn_risk:"低", notes:"",
};

const Field = ({label,k,form,setForm,type="text",ph="",full=false}:{label:string;k:keyof Customer;form:Customer;setForm:React.Dispatch<React.SetStateAction<Customer>>;type?:string;ph?:string;full?:boolean}) => (
  <div style={full?{gridColumn:"1/-1"}:{}}>
    <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{label}</p>
    <input type={type} value={String(form[k]||"")} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={ph}
      style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
  </div>
);
const SelectField = ({label,k,form,setForm,opts}:{label:string;k:keyof Customer;form:Customer;setForm:React.Dispatch<React.SetStateAction<Customer>>;opts:string[]}) => (
  <div>
    <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{label}</p>
    <select value={String(form[k]||"")} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
      style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
const TextArea = ({label,k,form,setForm,ph="",rows=2}:{label:string;k:keyof Customer;form:Customer;setForm:React.Dispatch<React.SetStateAction<Customer>>;ph?:string;rows?:number}) => (
  <div style={{gridColumn:"1/-1"}}>
    <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{label}</p>
    <textarea value={String(form[k]||"")} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} rows={rows} placeholder={ph}
      style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",resize:"vertical" as const,boxSizing:"border-box" as const}} className="focus:outline-none"/>
  </div>
);

type StoreIntelligence = {
  churn_trend: string; cast_fatigue: string; claim_chain: string;
  nomination_bias: string; revenue_stagnation: string; line_fatigue: string;
  proposals: string[];
};


function GuideSection() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",overflow:"hidden"}}>
      <button onClick={()=>setOpen(p=>!p)}
        style={{width:"100%",padding:"14px 20px",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"16px"}}>📖</span>
          <p style={{fontWeight:700,fontSize:"13px",color:"#111827"}}>使い方ガイド</p>
        </div>
        <span style={{color:"#9ca3af",fontSize:"12px"}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{padding:"0 20px 20px",borderTop:"1px solid rgba(0,0,0,0.06)"}}>
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"12px",padding:"14px 16px",marginBottom:"16px",marginTop:"12px"}}>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"10px"}}>📋 全体的な使い方の流れ</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {[
                {step:"① 初回準備",color:"#6366f1",items:["👤相性タブ：担当者を登録","🧠RAGタブ：業務ノウハウ・ルールを登録"]},
                {step:"② 顧客登録",color:"#059669",items:["「＋顧客登録」から各セクション入力","基本・来店・会話・行動・危険・AI推論"]},
                {step:"③ 日常運用（毎日）",color:"#d97706",items:["リスト画面の優先アクションを確認","AI分析で顧客ブリーフ・対応戦略を取得","⚡イベントで行動を記録","⚡推論でリアルタイム状態更新"]},
                {step:"④ 振り返り（週次）",color:"#0891b2",items:["🔄学習でフィードバック→AI洞察確認","📊グラフで推移・KPI確認","🏪店舗知能でAI経営提案を確認"]},
              ].map(({step,color,items})=>(
                <div key={step} style={{background:`${color}10`,borderRadius:"10px",padding:"10px 12px",border:`1px solid ${color}25`}}>
                  <p style={{color,fontWeight:700,fontSize:"11px",marginBottom:"6px"}}>{step}</p>
                  {items.map((item,i)=>(
                    <p key={i} style={{color:"rgba(255,255,255,0.7)",fontSize:"10px",lineHeight:1.6,marginBottom:"2px"}}>• {item}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginTop:"16px"}}>
            {[
              {icon:"👥",title:"顧客登録",items:["「＋顧客登録」から新規登録","基本・来店・会話・行動・危険・AIの6セクションに分かれています","⚠️危険セクションはリスク情報・要注意情報を管理"]},
              {icon:"🌡️",title:"顧客温度",items:["S：最優先（最高警戒・丁寧に対応）","A：高ロイヤル（関係が深い・維持優先）","B：安定（通常対応）","C：離脱兆候（要フォロー）","D：休眠（長期未接触）"]},
              {icon:"🤖",title:"AI分析",items:["顧客詳細画面の「AI分析を実行」で起動","対応ブリーフ・推奨アプローチ・連絡戦略を生成","AIは断定せず傾向・確率で提示します","前回推論との差分がある場合、状態遷移履歴に記録されます"]},
              {icon:"🚨",title:"優先アクション",items:["リスト画面上部に「今日の優先アクション」を表示","今日連絡すべき顧客・離脱危険顧客・売上期待顧客・放置推奨顧客を分類","顧客登録・イベント記録・AI分析後に自動再計算されます"]},
              {icon:"🏪",title:"店舗・組織知能",items:["「店舗知能」ボタンから起動","あなたが登録した顧客データのみを解析します","心理タイプ分布・温度分布グラフ・AI経営提案を生成"]},
              {icon:"⚠️",title:"注意事項",items:["AI分析結果は確率・傾向の提示です。断定ではありません","危険情報は厳重に管理してください","最終的な判断は必ず担当者自身が行ってください","個人情報は適切に取り扱ってください"]},
              {icon:"📊",title:"グラフ（📊グラフ）",items:["温度推移グラフ：AI分析実行のたびに自動記録","行動指標：行動情報セクションの数値を可視化","売上推計：利用回数・累計金額から平均単価を推計","状態遷移ログ：温度変化の履歴を一覧表示"]},
              {icon:"🤖",title:"AI推論設定（🤖AIタブ）",items:["温度・タイプ・現在状態・危険度は「AI分析を実行」で自動推論されます","手動で上書き設定することも可能です","優先アクションの再計算・対応方向性の生成に反映されます","メモ・特記事項はAI分析プロンプトに渡され推論精度が向上します"]},
              {icon:"👤",title:"担当者相性（👤相性）",items:["まず相性タブから担当者を登録（名前・強み・担当等）","顧客詳細の相性タブで「AI解析を実行」→最推奨担当者・危険な組み合わせを表示","結果フィードバックを蓄積するほどAI精度が向上します","成約率・継続率・売上UPに直結する最適配置が目的です"]},
              {icon:"🔄",title:"フィードバック学習（🔄学習）",items:["AI提案の実行結果を記録してAIの精度を改善","アクション種別・結果・売上変化・継続状況を記録","統計画面でアクション別成功率を確認できます","AI洞察で効果的・非効果的なアクションを分析"]},
              {icon:"⚡",title:"イベントストリーム（⚡イベント）",items:["業種別カテゴリで全行動を時系列記録","カテゴリ別フィルタで絞り込み表示","タイムライン形式で時系列を把握","記録したイベントは削除も可能"]},
              {icon:"🧠",title:"マルチRAG（🧠RAG）",items:["業種別ナレッジ種別で情報を管理","登録したナレッジは検索・確認でき、対応判断の補助情報として活用できます","ベクトル検索で類似ナレッジを素早く検索","タグ付きで管理・分類が可能"]},
              {icon:"⚡",title:"リアルタイム推論（⚡推論）",items:["イベント発生時に必要な場合のみAI推論を実行します","業種別プリセットから選択またはカスタムイベントを入力","推論結果で顧客の温度・状態・離脱リスクを更新","推論履歴で状態変化の流れを追跡できます"]},
            ].map(({icon,title,items})=>(
              <div key={title} style={{background:"#f8f9fc",borderRadius:"12px",padding:"12px 14px"}}>
                <p style={{fontWeight:700,fontSize:"12px",color:"#111827",marginBottom:"8px"}}>{icon} {title}</p>
                <ul style={{margin:0,padding:"0 0 0 14px"}}>
                  {items.map((item,i)=>(
                    <li key={i} style={{color:"#6b7280",fontSize:"10px",lineHeight:1.7,marginBottom:"1px"}}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TEMP_SCORE: Record<string,number> = {S:5,A:4,B:3,C:2,D:1};

function CustomerGraphSection({customer, transitions}:{customer:Customer;transitions:any[]}) {
  // 状態遷移から温度推移グラフデータ生成
  const tempData = React.useMemo(()=>{
    if(!transitions||transitions.length===0){
      return [{date:"現在",温度スコア:TEMP_SCORE[customer.temp]||3,温度:customer.temp}];
    }
    const sorted = [...transitions].sort((a,b)=>(a.detected_at||"").localeCompare(b.detected_at||""));
    const data = sorted.map((t:any)=>({
      date:(t.detected_at||"").slice(0,10),
      温度スコア:TEMP_SCORE[t.current_temperature]||3,
      温度:t.current_temperature,
    }));
    data.push({date:"現在",温度スコア:TEMP_SCORE[customer.temp]||3,温度:customer.temp});
    return data;
  },[transitions,customer.temp]);

  // 業種別グラフメタ
  const _graphMeta: Record<string,{actionTitle:string;usageTitle:string;usageLabel1:string;usageLabel2:string}> = {
    nightlife:{actionTitle:"📱 LINE・行動指標",usageTitle:"💰 来店・売上推計",usageLabel1:"来店回数",usageLabel2:"来店周期"},
    retail:{actionTitle:"📱 反応・購買行動指標",usageTitle:"💰 購買・売上推計",usageLabel1:"購入回数",usageLabel2:"購買周期"},
    b2b:{actionTitle:"📧 商談・連絡行動指標",usageTitle:"💰 案件・契約推計",usageLabel1:"商談回数",usageLabel2:"接触周期"},
    beauty:{actionTitle:"📱 予約・反応指標",usageTitle:"💰 来店・施術売上推計",usageLabel1:"施術回数",usageLabel2:"来店周期"},
    fitness:{actionTitle:"📱 来館・継続行動指標",usageTitle:"💰 契約・継続推計",usageLabel1:"セッション回数",usageLabel2:"来館周期"},
    realestate:{actionTitle:"📞 内見・商談行動指標",usageTitle:"💰 案件・成約推計",usageLabel1:"内見回数",usageLabel2:"接触周期"},
    other:{actionTitle:"📱 行動指標",usageTitle:"💰 利用・売上推計",usageLabel1:"利用回数",usageLabel2:"利用周期"},
  };
  const _gm = _graphMeta[customer.industry]||_graphMeta["other"];
  // 利用・売上データ（手動入力値から推計）
  const visitData = React.useMemo(()=>{
    const count = parseInt(customer.visit_count||"0")||0;
    const cycle = parseInt(customer.visit_cycle||"14")||14;
    const total = parseInt(customer.spend_total||"0")||0;
    const avgSpend = count>0?Math.round(total/count):0;
    if(count===0) return [];
    const data = [];
    for(let i=Math.max(0,count-5);i<=count;i++){
      data.push({
        回数:`${i}回目`,
        推定売上:avgSpend,
        来店間隔:cycle,
      });
    }
    return data;
  },[customer.visit_count,customer.visit_cycle,customer.spend_total]);

  // LINE反応データ（業種別ラベル）
  const _ind = customer.industry||"nightlife";
  const _lineLabels: Record<string,string[]> = {
    nightlife:["返信率","深夜反応率","当日予約率","ドタキャン率"],
    retail:["返信率","セール反応率","当日来店率","返品率"],
    b2b:["メール返信率","電話接続率","商談出席率","キャンセル率"],
    beauty:["予約返信率","SNS反応率","当日予約率","キャンセル率"],
    fitness:["連絡返信率","欠席率","当日予約率","継続率"],
    realestate:["返信率","内見反応率","即決率","キャンセル率"],
    other:["返信率","反応率","当日率","キャンセル率"],
  };
  const _ll = _lineLabels[_ind]||_lineLabels["other"];
  const lineData = React.useMemo(()=>[
    {指標:_ll[0],値:parseInt(customer.line_reply_rate||"0")||0},
    {指標:_ll[1],値:parseInt(customer.late_night_rate||"0")||0},
    {指標:_ll[2],値:parseInt(customer.same_day_rate||"0")||0},
    {指標:_ll[3],値:parseInt(customer.cancel_rate||"0")||0},
  ],[customer]);

  const TEMP_COLOR_MAP: Record<string,string> = {S:"#dc2626",A:"#d97706",B:"#059669",C:"#0891b2",D:"#6b7280"};

  return (
    <div className="space-y-4">
      {/* 温度推移グラフ */}
      <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"4px"}}>🌡️ 顧客温度推移</p>
        <p style={{color:"#9ca3af",fontSize:"10px",marginBottom:"12px"}}>AI分析を実行するたびに記録されます</p>
        {tempData.length<=1&&transitions.length===0?(
          <div style={{background:"#f8f9fc",borderRadius:"10px",padding:"20px",textAlign:"center" as const}}>
            <p style={{color:"#9ca3af",fontSize:"12px"}}>AI分析を実行すると温度推移が記録されます</p>
          </div>
        ):(
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={tempData} margin={{top:8,right:16,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
              <XAxis dataKey="date" tick={{fontSize:9,fill:"#9ca3af"}} tickLine={false}/>
              <YAxis domain={[1,5]} ticks={[1,2,3,4,5]} tickFormatter={(v:number)=>({1:"D",2:"C",3:"B",4:"A",5:"S"}[v]||"")} tick={{fontSize:10,fill:"#6b7280"}} tickLine={false}/>
              <Tooltip formatter={(v:any,n:any,p:any)=>[p.payload?.温度||v,"温度"]} labelStyle={{fontSize:"11px"}} contentStyle={{fontSize:"11px",borderRadius:"8px",border:"1px solid rgba(0,0,0,0.08)"}}/>
              <Line type="monotone" dataKey="温度スコア" stroke="#4f46e5" strokeWidth={2} dot={{fill:"#4f46e5",r:4}} activeDot={{r:6}}/>
            </LineChart>
          </ResponsiveContainer>
        )}
        {/* 現在温度バッジ */}
        <div style={{display:"flex",gap:"8px",marginTop:"10px",flexWrap:"wrap" as const}}>
          {Object.entries(TEMP_SCORE).map(([k])=>(
            <div key={k} style={{padding:"4px 12px",borderRadius:"99px",background:customer.temp===k?TEMP_COLOR_MAP[k]+"20":"rgba(0,0,0,0.04)",border:`1px solid ${customer.temp===k?TEMP_COLOR_MAP[k]:"transparent"}`,fontSize:"11px",fontWeight:customer.temp===k?700:400,color:customer.temp===k?TEMP_COLOR_MAP[k]:"#9ca3af"}}>
              {k}
            </div>
          ))}
        </div>
      </div>

      {/* LINE反応率グラフ */}
      <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{fontWeight:700,fontSize:"12px",color:"#059669",marginBottom:"4px"}}>{_gm.actionTitle}</p>
        <p style={{color:"#9ca3af",fontSize:"10px",marginBottom:"12px"}}>行動情報セクションの入力値を可視化</p>
        {lineData.every(d=>d.値===0)?(
          <div style={{background:"#f8f9fc",borderRadius:"10px",padding:"20px",textAlign:"center" as const}}>
            <p style={{color:"#9ca3af",fontSize:"12px"}}>行動情報セクションに数値を入力するとグラフが表示されます</p>
          </div>
        ):(
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={lineData} margin={{top:8,right:16,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
              <XAxis dataKey="指標" tick={{fontSize:9,fill:"#9ca3af"}} tickLine={false}/>
              <YAxis domain={[0,100]} tickFormatter={(v:number)=>`${v}%`} tick={{fontSize:9,fill:"#9ca3af"}} tickLine={false}/>
              <Tooltip formatter={(v:any)=>[`${v}%`]} contentStyle={{fontSize:"11px",borderRadius:"8px",border:"1px solid rgba(0,0,0,0.08)"}}/>
              <Bar dataKey="値" fill="#059669" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 来店・売上推計グラフ */}
      <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{fontWeight:700,fontSize:"12px",color:"#d97706",marginBottom:"4px"}}>{_gm.usageTitle}</p>
        <p style={{color:"#9ca3af",fontSize:"10px",marginBottom:"12px"}}>{_gm.usageLabel1}・累計金額から平均単価を推計</p>
        {visitData.length===0?(
          <div style={{background:"#f8f9fc",borderRadius:"10px",padding:"20px",textAlign:"center" as const}}>
            <p style={{color:"#9ca3af",fontSize:"12px"}}>来店情報セクションに回数・金額を入力するとグラフが表示されます</p>
          </div>
        ):(
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={visitData} margin={{top:8,right:16,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
              <XAxis dataKey="回数" tick={{fontSize:9,fill:"#9ca3af"}} tickLine={false}/>
              <YAxis tickFormatter={(v:number)=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:9,fill:"#9ca3af"}} tickLine={false}/>
              <Tooltip formatter={(v:any)=>[`¥${Number(v).toLocaleString()}`,"推定売上"]} contentStyle={{fontSize:"11px",borderRadius:"8px",border:"1px solid rgba(0,0,0,0.08)"}}/>
              <Bar dataKey="推定売上" fill="#d97706" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* 来店サマリー */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginTop:"12px"}}>
          {[
            [_gm.usageLabel1,`${customer.visit_count||"0"}回`],
            [_gm.usageLabel2,`${customer.visit_cycle||"-"}日`],
            ["累計利用",`¥${parseInt(customer.spend_total||"0").toLocaleString()}`],
          ].map(([l,v])=>(
            <div key={l} style={{background:"rgba(217,119,6,0.06)",borderRadius:"10px",padding:"8px 12px",textAlign:"center" as const}}>
              <p style={{color:"#9ca3af",fontSize:"9px",fontWeight:600}}>{l}</p>
              <p style={{color:"#d97706",fontWeight:800,fontSize:"14px"}}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 状態遷移履歴テーブル */}
      {transitions.length>0&&(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>📋 状態遷移ログ</p>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:"11px"}}>
              <thead>
                <tr>
                  {["日時","温度変化","欲求変化","トリガー"].map(h=>(
                    <th key={h} style={{background:"rgba(79,70,229,0.06)",border:"1px solid rgba(0,0,0,0.06)",padding:"6px 10px",color:"#4f46e5",fontWeight:700,textAlign:"left" as const,whiteSpace:"nowrap" as const}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transitions.map((t:any,i:number)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":"rgba(0,0,0,0.01)"}}>
                    <td style={{border:"1px solid rgba(0,0,0,0.06)",padding:"6px 10px",color:"#9ca3af",whiteSpace:"nowrap" as const}}>{(t.detected_at||"").slice(0,16)}</td>
                    <td style={{border:"1px solid rgba(0,0,0,0.06)",padding:"6px 10px"}}>
                      <span style={{color:TEMP_COLOR_MAP[t.previous_temperature]||"#6b7280",fontWeight:700}}>{t.previous_temperature}</span>
                      <span style={{color:"#9ca3af",margin:"0 4px"}}>→</span>
                      <span style={{color:TEMP_COLOR_MAP[t.current_temperature]||"#6b7280",fontWeight:700}}>{t.current_temperature}</span>
                    </td>
                    <td style={{border:"1px solid rgba(0,0,0,0.06)",padding:"6px 10px",color:"#6b7280"}}>{t.current_desire||"-"}</td>
                    <td style={{border:"1px solid rgba(0,0,0,0.06)",padding:"6px 10px",color:"#6b7280",maxWidth:"200px"}}>{t.trigger_reason||"-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type Cast = {
  id?: string;
  name: string;
  strong_types: string;
  weak_types: string;
  line_success_rate: string;
  avg_upsell_rate: string;
  notes: string;
};
const EMPTY_CAST: Cast = {name:"",strong_types:"",weak_types:"",line_success_rate:"",avg_upsell_rate:"",notes:""};

function CastAffinitySection({customer,industry}:{customer:Customer;industry:string}) {
  const meta = INDUSTRY_META[industry]||INDUSTRY_META["nightlife"];
  const [casts, setCasts] = React.useState<Cast[]>([]);
  const [castForm, setCastForm] = React.useState<Cast>(EMPTY_CAST);
  const [editingCast, setEditingCast] = React.useState<Cast|null>(null);
  const [showCastForm, setShowCastForm] = React.useState(false);
  const [affinityResult, setAffinityResult] = React.useState<any>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fbCast, setFbCast] = React.useState("");
  const [fbResult, setFbResult] = React.useState("成功");
  const [fbNotes, setFbNotes] = React.useState("");
  const [fbSaving, setFbSaving] = React.useState(false);

  React.useEffect(()=>{loadCasts();},[]);

  async function loadCasts() {
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_cast_list`,{headers:authHeaders()});
      if(res.ok){const d=await res.json();setCasts(d.casts||[]);}
    } catch{}
  }
  async function saveCast() {
    setSaving(true);setError("");
    try {
      const method = castForm.id?"PUT":"POST";
      const url = castForm.id?`${API_BASE}/api/diagnosis/crm_cast/${castForm.id}`:`${API_BASE}/api/diagnosis/crm_cast`;
      const res = await fetch(url,{method,headers:authHeaders(),body:JSON.stringify(castForm)});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"保存失敗");}
      await loadCasts();setShowCastForm(false);setCastForm(EMPTY_CAST);setEditingCast(null);
    } catch(e:any){setError(e.message);}finally{setSaving(false);}
  }
  async function deleteCast(id:string) {
    if(!confirm("`この${meta.staffNoun}を削除しますか？`"))return;
    try {
      await fetch(`${API_BASE}/api/diagnosis/crm_cast/${id}`,{method:"DELETE",headers:authHeaders()});
      await loadCasts();
    } catch{}
  }
  async function analyzeAffinity() {
    if(casts.length===0){
      setError(`先に${meta.staffNoun}を登録してください`);
      return;
    }
    setAnalyzing(true);setAffinityResult(null);setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_cast_affinity`,{method:"POST",headers:authHeaders(),body:JSON.stringify({customer,cast_id:"",industry})});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"分析失敗");}
      const d=await res.json();setAffinityResult(d.result);
    } catch(e:any){setError(e.message);}finally{setAnalyzing(false);}
  }
  async function saveFeedback() {
    if(!fbCast){setError(`${meta.staffNoun}を選択してください`);return;}
    setFbSaving(true);
    try {
      await fetch(`${API_BASE}/api/diagnosis/crm_cast_feedback`,{method:"POST",headers:authHeaders(),body:JSON.stringify({customer_id:customer.id||"",cast_id:fbCast,result:fbResult,notes:fbNotes})});
      setFbCast("");setFbNotes("");setError("");
      alert("フィードバックを記録しました");
    } catch{}finally{setFbSaving(false);}
  }

  const RISK_COLOR: Record<string,string> = {"低":"#059669","中":"#d97706","高":"#dc2626"};

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"4px"}}>{meta.castEnLabel}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:"white",fontWeight:800,fontSize:"15px",marginBottom:"2px"}}>{meta.staffIcon} {meta.castHeader}</p>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px"}}>{meta.castSub}</p>
          </div>
          <button onClick={()=>{setShowCastForm(true);setCastForm(EMPTY_CAST);setEditingCast(null);}}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"11px",padding:"8px 14px",cursor:"pointer"}}>
            ＋ {meta.staffNoun}登録
          </button>
        </div>
      </div>

      {error&&<p style={{color:"#dc2626",fontSize:"12px",padding:"8px 12px",background:"rgba(220,38,38,0.08)",borderRadius:"8px"}}>⚠️ {error}</p>}

      {/* キャスト登録フォーム */}
      {showCastForm&&(
        <div style={{background:"white",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>{castForm.id?`${meta.staffNoun}編集`:`新規${meta.staffNoun}登録`}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
            {(()=>{
              const _castFields: Record<string,{label:string;k:keyof Cast;ph:string}[]> = {
                nightlife:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意な心理タイプ",k:"strong_types",ph:"承認型・癒し型"},
                  {label:"苦手な心理タイプ",k:"weak_types",ph:"支配型・比較検討型"},
                  {label:"LINE成功率(%)",k:"line_success_rate",ph:"75"},
                  {label:"平均単価UP率(%)",k:"avg_upsell_rate",ph:"30"},
                ],
                retail:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意な接客スタイル",k:"strong_types",ph:"提案型・傾聴型"},
                  {label:"苦手な顧客タイプ",k:"weak_types",ph:"クレーム型・値引き要求型"},
                  {label:"接客成功率(%)",k:"line_success_rate",ph:"75"},
                  {label:"高単価化率(%)",k:"avg_upsell_rate",ph:"30"},
                ],
                b2b:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意な業種・案件",k:"strong_types",ph:"製造業・大手企業"},
                  {label:"苦手な案件タイプ",k:"weak_types",ph:"短期案件・低予算"},
                  {label:"商談成約率(%)",k:"line_success_rate",ph:"40"},
                  {label:"平均受注UP率(%)",k:"avg_upsell_rate",ph:"20"},
                ],
                beauty:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意な施術・顧客",k:"strong_types",ph:"カラー・敏感肌"},
                  {label:"苦手な施術・顧客",k:"weak_types",ph:"過剰要求型"},
                  {label:"指名成功率(%)",k:"line_success_rate",ph:"70"},
                  {label:"物販提案成功率(%)",k:"avg_upsell_rate",ph:"25"},
                ],
                fitness:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意な指導スタイル",k:"strong_types",ph:"褒めて伸ばす・目標設定型"},
                  {label:"苦手な会員タイプ",k:"weak_types",ph:"モチベ低下型・怪我持ち"},
                  {label:"継続率(%)",k:"line_success_rate",ph:"80"},
                  {label:"更新成功率(%)",k:"avg_upsell_rate",ph:"60"},
                ],
                realestate:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意エリア・物件",k:"strong_types",ph:"都心マンション・投資物件"},
                  {label:"苦手な顧客タイプ",k:"weak_types",ph:"条件過多・低予算"},
                  {label:"成約率(%)",k:"line_success_rate",ph:"30"},
                  {label:"アップセル率(%)",k:"avg_upsell_rate",ph:"15"},
                ],
                other:[
                  {label:`${meta.staffNoun}名*`,k:"name",ph:`${meta.staffNoun}の名前`},
                  {label:"得意な対応",k:"strong_types",ph:""},
                  {label:"苦手な対応",k:"weak_types",ph:""},
                  {label:"成功率(%)",k:"line_success_rate",ph:"70"},
                  {label:"単価UP率(%)",k:"avg_upsell_rate",ph:"20"},
                ],
              };
              const _cf = _castFields[industry]||_castFields["other"];
              return _cf;
            })().map(({label,k,ph})=>(
              <div key={k}>
                <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{label}</p>
                <input value={String(castForm[k]||"")} onChange={e=>setCastForm(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                  style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>備考・特徴</p>
              <textarea value={castForm.notes} onChange={e=>setCastForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="接客スタイル・得意なこと"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",resize:"vertical" as const,boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={saveCast} disabled={saving||!castForm.name.trim()}
              style={{flex:1,padding:"10px",borderRadius:"10px",background:saving||!castForm.name.trim()?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:"pointer"}}>
              {saving?"保存中...":"💾 保存"}
            </button>
            <button onClick={()=>{setShowCastForm(false);setCastForm(EMPTY_CAST);}}
              style={{padding:"10px 16px",borderRadius:"10px",background:"rgba(0,0,0,0.05)",border:"none",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>キャンセル</button>
          </div>
        </div>
      )}

      {/* キャスト一覧 */}
      {casts.length>0&&(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>👥 登録{meta.staffNoun}（{casts.length}名）</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px"}}>
            {casts.map((cast,i)=>(
              <div key={cast.id||i} style={{background:"#f8f9fc",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(0,0,0,0.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                  <p style={{fontWeight:700,fontSize:"13px",color:"#111827"}}>{meta.staffIcon} {cast.name}</p>
                  <div style={{display:"flex",gap:"4px"}}>
                    <button onClick={()=>{setCastForm(cast);setShowCastForm(true);}} style={{fontSize:"10px",color:"#4f46e5",background:"none",border:"1px solid #4f46e5",borderRadius:"4px",padding:"1px 6px",cursor:"pointer"}}>編集</button>
                    <button onClick={()=>deleteCast(cast.id!)} style={{fontSize:"10px",color:"#dc2626",background:"none",border:"1px solid #dc2626",borderRadius:"4px",padding:"1px 6px",cursor:"pointer"}}>削除</button>
                  </div>
                </div>
                <p style={{color:"#059669",fontSize:"10px",marginBottom:"2px"}}>✅ 得意: {cast.strong_types||"-"}</p>
                <p style={{color:"#dc2626",fontSize:"10px",marginBottom:"2px"}}>❌ 苦手: {cast.weak_types||"-"}</p>
                <p style={{color:"#6b7280",fontSize:"10px"}}>LINE成功率: {cast.line_success_rate||"-"}%</p>
              </div>
            ))}
          </div>
          <button onClick={analyzeAffinity} disabled={analyzing}
            style={{width:"100%",marginTop:"12px",padding:"11px",borderRadius:"12px",background:analyzing?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#059669,#0891b2)",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:analyzing?"not-allowed":"pointer"}}>
            {analyzing?"🤖 相性解析中...":"🤖 この顧客との相性をAI解析"}
          </button>
        </div>
      )}

      {/* 相性解析結果 */}
      {affinityResult&&(
        <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"12px"}}>🤖 相性解析レポート</p>
          {/* 最推奨・危険 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
            <div style={{background:"rgba(5,150,105,0.15)",borderRadius:"10px",padding:"10px 14px",border:"1px solid rgba(5,150,105,0.3)"}}>
              <p style={{color:"#6ee7b7",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>{`✅ 最推奨${meta.staffNoun}`}</p>
              <p style={{color:"white",fontWeight:800,fontSize:"15px"}}>{affinityResult.best_cast||"-"}</p>
            </div>
            <div style={{background:"rgba(220,38,38,0.15)",borderRadius:"10px",padding:"10px 14px",border:"1px solid rgba(220,38,38,0.3)"}}>
              <p style={{color:"#fca5a5",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>⚠️ 危険な組み合わせ</p>
              <p style={{color:"white",fontWeight:800,fontSize:"15px"}}>{affinityResult.danger_cast||"なし"}</p>
              {affinityResult.danger_reason&&<p style={{color:"rgba(255,255,255,0.5)",fontSize:"9px",marginTop:"3px"}}>{affinityResult.danger_reason}</p>}
            </div>
          </div>
          {/* ランキング */}
          {(affinityResult.rankings||[]).map((r:any,i:number)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:"10px",padding:"10px 14px",marginBottom:"8px",border:`1px solid ${RISK_COLOR[r.risk]||"rgba(255,255,255,0.1)"}30`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                <p style={{color:"white",fontWeight:700,fontSize:"13px"}}>#{i+1} {r.cast_name}</p>
                <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                  <span style={{background:`${RISK_COLOR[r.risk]||"#6b7280"}20`,border:`1px solid ${RISK_COLOR[r.risk]||"#6b7280"}40`,borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:RISK_COLOR[r.risk]||"#6b7280",fontWeight:600}}>リスク:{r.risk}</span>
                  <span style={{color:"#a5b4fc",fontWeight:800,fontSize:"16px"}}>{r.score}</span>
                </div>
              </div>
              <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"4px"}}>{r.reason}</p>
              <p style={{color:"#6ee7b7",fontSize:"10px"}}>→ {r.approach}</p>
            </div>
          ))}
          {affinityResult.overall_advice&&(
            <div style={{background:"rgba(99,102,241,0.15)",borderRadius:"10px",padding:"10px 14px",border:"1px solid rgba(99,102,241,0.3)"}}>
              <p style={{color:"#a5b4fc",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>💡 総合アドバイス</p>
              <p style={{color:"white",fontSize:"12px",lineHeight:1.6}}>{affinityResult.overall_advice}</p>
            </div>
          )}
        </div>
      )}

      {/* フィードバック記録 */}
      {casts.length>0&&customer.id&&(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>📝 接客結果フィードバック</p>
          <p style={{color:"#9ca3af",fontSize:"10px",marginBottom:"12px"}}>実際の接客結果を記録してAIの学習精度を上げます</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{`担当${meta.staffNoun}`}</p>
              <select value={fbCast} onChange={e=>setFbCast(e.target.value)}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                <option value="">選択してください</option>
                {casts.map(c=><option key={c.id} value={c.id||""}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>結果</p>
              <select value={fbResult} onChange={e=>setFbResult(e.target.value)}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                {["成功","普通","失敗","クレーム","再来なし"].map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>メモ</p>
              <input value={fbNotes} onChange={e=>setFbNotes(e.target.value)} placeholder="特記事項があれば入力"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
          </div>
          <button onClick={saveFeedback} disabled={fbSaving||!fbCast}
            style={{width:"100%",padding:"10px",borderRadius:"10px",background:fbSaving||!fbCast?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:fbSaving||!fbCast?"not-allowed":"pointer"}}>
            {fbSaving?"記録中...":"📝 フィードバックを記録"}
          </button>
        </div>
      )}
    </div>
  );
}

function ActionFeedbackSection({customer,industry}:{customer:Customer;industry:string}) {
  const meta = INDUSTRY_META[industry]||INDUSTRY_META["nightlife"];
  const [logs, setLogs] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    action_type:"LINE送信",
    ai_proposal:"",
    executed:true,
    result:"成功",
    revenue_change:"",
    revisit:false,
    notes:"",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(()=>{loadLogs();loadStats();},[]);

  async function loadLogs() {
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_action_feedback_list`,{headers:authHeaders()});
      if(res.ok){const d=await res.json();setLogs(d.logs||[]);}
    } catch{}
  }
  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_feedback_stats`,{headers:authHeaders()});
      if(res.ok){const d=await res.json();setStats(d.stats);}
    } catch{}finally{setStatsLoading(false);}
  }
  async function saveFeedback() {
    setSaving(true);setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_action_feedback`,{
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({
          customer_id:customer.id||"",
          customer_name:customer.name||"",
          ...form,
        }),
      });
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"保存失敗");}
      await loadLogs();await loadStats();
      setShowForm(false);
      setForm({action_type:ACTION_TYPES[0]||"LINE送信",ai_proposal:"",executed:true,result:RESULTS[0]||"成功",revenue_change:"",revisit:false,notes:""});
    } catch(e:any){setError(e.message);}finally{setSaving(false);}
  }

  const _INDUSTRY_ACTION_TYPES: Record<string,string[]> = {
    nightlife: meta.feedbackActions.length>0 ? meta.feedbackActions : ["LINE送信","接客スタイル変更","オプション提案","特別感演出","放置戦略","距離感調整","その他"],
    retail: ["来店促進DM","商品提案","クーポン送付","セール案内","VIP対応","フォローアップ","その他"],
    b2b: ["訪問","電話フォロー","提案書送付","見積送付","契約促進","情報提供","その他"],
    beauty: ["来店促進LINE","クーポン送付","新メニュー案内","誕生日オファー","VIP対応","フォロー","その他"],
    fitness: ["来館促進LINE","進捗フォロー","新プログラム提案","目標再設定","VIP対応","その他"],
    realestate: ["新着物件紹介","フォロー電話","資料送付","内見促進","契約促進","情報提供","その他"],
    other: ["フォロー連絡","案内送付","提案","対応","放置","その他"],
  };
  const _INDUSTRY_RESULTS: Record<string,string[]> = {
    nightlife: ["成功","普通","失敗","再来あり","再来なし","クレーム"],
    retail: ["購入成功","高単価化","口コミ化","クレーム回避","返品防止","失敗"],
    b2b: ["商談化","契約化","失注回避","アップセル","稟議突破","失敗"],
    beauty: ["指名化","再来成功","物販成功","仕上がり満足","クレーム回避","失敗"],
    fitness: ["継続成功","更新成功","退会防止","モチベ回復","怪我回避","失敗"],
    realestate: ["内見化","申込化","契約化","他社流出防止","条件整理成功","失敗"],
    other: ["成功","普通","失敗","継続","離脱","その他"],
  };
  const ACTION_TYPES = _INDUSTRY_ACTION_TYPES[industry]||_INDUSTRY_ACTION_TYPES["other"];
  const RESULTS = _INDUSTRY_RESULTS[industry]||_INDUSTRY_RESULTS["other"];
  const RESULT_COLORS: Record<string,string> = {"成功":"#059669","再来あり":"#059669","普通":"#d97706","失敗":"#dc2626","再来なし":"#dc2626","クレーム":"#7c3aed"};

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"4px"}}>ACTION FEEDBACK LEARNING</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:"white",fontWeight:800,fontSize:"15px",marginBottom:"2px"}}>🔄 フィードバック学習</p>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px"}}>AI提案の実行結果を記録してAIの精度を改善します</p>
          </div>
          <button onClick={()=>setShowForm(p=>!p)}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"11px",padding:"8px 14px",cursor:"pointer"}}>
            ＋ 記録する
          </button>
        </div>
      </div>

      {error&&<p style={{color:"#dc2626",fontSize:"12px",padding:"8px 12px",background:"rgba(220,38,38,0.08)",borderRadius:"8px"}}>⚠️ {error}</p>}

      {/* 記録フォーム */}
      {showForm&&(
        <div style={{background:"white",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>📝 アクション結果を記録</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>アクション種別</p>
              <select value={form.action_type} onChange={e=>setForm(p=>({...p,action_type:e.target.value}))}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                {ACTION_TYPES.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>結果</p>
              <select value={form.result} onChange={e=>setForm(p=>({...p,result:e.target.value}))}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                {RESULTS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>AI提案内容（何をしたか）</p>
              <input value={form.ai_proposal} onChange={e=>setForm(p=>({...p,ai_proposal:e.target.value}))} placeholder="例：短文で承認メッセージを送信した"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>売上変化（円）</p>
              <input value={form.revenue_change} onChange={e=>setForm(p=>({...p,revenue_change:e.target.value}))} placeholder="例：+5000"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{{"nightlife":"再来店","retail":"再購入","b2b":"商談化/契約","beauty":"再来店","fitness":"継続","realestate":"申込/契約","other":"継続/再利用"}[industry]||"継続/再利用"}</p>
              <div style={{display:"flex",gap:"8px"}}>
                {[true,false].map(v=>(
                  <button key={String(v)} onClick={()=>setForm(p=>({...p,revisit:v}))}
                    style={{flex:1,padding:"8px",borderRadius:"8px",border:`1px solid ${form.revisit===v?"#4f46e5":"rgba(0,0,0,0.08)"}`,background:form.revisit===v?"rgba(79,70,229,0.1)":"#f8f9fc",color:form.revisit===v?"#4f46e5":"#6b7280",fontSize:"12px",fontWeight:form.revisit===v?700:400,cursor:"pointer"}}>
                    {v?"あり":"なし"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>メモ</p>
              <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="気づいたこと・反省点"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",resize:"vertical" as const,boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={saveFeedback} disabled={saving}
              style={{flex:1,padding:"10px",borderRadius:"10px",background:saving?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:"pointer"}}>
              {saving?"保存中...":"💾 記録する"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{padding:"10px 16px",borderRadius:"10px",background:"rgba(0,0,0,0.05)",border:"none",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 統計・AI洞察 */}
      {statsLoading?(
        <p style={{color:"#9ca3af",textAlign:"center" as const,padding:"16px",fontSize:"12px"}}>統計を読み込み中...</p>
      ):stats?(
        <div className="space-y-3">
          {/* KPI */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {[
              ["総記録数",`${stats.total}件`,"#4f46e5"],
              ["実行率",`${stats.execution_rate}%`,"#059669"],
              ["成功率",`${stats.success_rate}%`,"#d97706"],
              ["再来率",`${stats.revisit_rate}%`,"#0891b2"],
            ].map(([l,v,c])=>(
              <div key={l as string} style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"12px",padding:"10px 12px",textAlign:"center" as const}}>
                <p style={{color:"#9ca3af",fontSize:"9px",fontWeight:600,marginBottom:"4px"}}>{l as string}</p>
                <p style={{color:c as string,fontWeight:800,fontSize:"18px"}}>{v as string}</p>
              </div>
            ))}
          </div>
          {/* アクション別統計 */}
          {Object.keys(stats.action_types||{}).length>0&&(
            <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"14px 18px"}}>
              <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"10px"}}>📊 アクション別成功率</p>
              {Object.entries(stats.action_types as Record<string,{total:number;success:number}>).map(([k,v])=>{
                const rate = v.total>0?Math.round(v.success/v.total*100):0;
                return(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                    <span style={{color:"#6b7280",fontSize:"11px",width:"100px",flexShrink:0}}>{k}</span>
                    <div style={{flex:1,background:"rgba(0,0,0,0.06)",borderRadius:"99px",height:"6px"}}>
                      <div style={{width:`${rate}%`,height:"6px",background:rate>=70?"#059669":rate>=40?"#d97706":"#dc2626",borderRadius:"99px"}}/>
                    </div>
                    <span style={{color:"#6b7280",fontSize:"10px",width:"50px",textAlign:"right" as const}}>{rate}% ({v.total}件)</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* AI洞察 */}
          {stats.insight&&(
            <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"12px"}}>🤖 AI学習洞察</p>
              {stats.insight.effective_actions?.length>0&&(
                <div style={{marginBottom:"10px"}}>
                  <p style={{color:"#6ee7b7",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>✅ 効果的だったアクション</p>
                  {stats.insight.effective_actions.map((a:string,i:number)=>(
                    <p key={i} style={{color:"rgba(255,255,255,0.8)",fontSize:"11px",marginBottom:"3px"}}>• {a}</p>
                  ))}
                </div>
              )}
              {stats.insight.ineffective_actions?.length>0&&(
                <div style={{marginBottom:"10px"}}>
                  <p style={{color:"#fca5a5",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>❌ 効果が低かったアクション</p>
                  {stats.insight.ineffective_actions.map((a:string,i:number)=>(
                    <p key={i} style={{color:"rgba(255,255,255,0.7)",fontSize:"11px",marginBottom:"3px"}}>• {a}</p>
                  ))}
                </div>
              )}
              {stats.insight.patterns&&(
                <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"10px",padding:"10px 12px",marginBottom:"10px"}}>
                  <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>🔍 成功パターン</p>
                  <p style={{color:"rgba(255,255,255,0.85)",fontSize:"11px",lineHeight:1.6}}>{stats.insight.patterns}</p>
                </div>
              )}
              {stats.insight.recommendations?.length>0&&(
                <div>
                  <p style={{color:"#a5b4fc",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>💡 今後の推奨方針</p>
                  {stats.insight.recommendations.map((r:string,i:number)=>(
                    <div key={i} style={{display:"flex",gap:"8px",marginBottom:"4px"}}>
                      <span style={{background:"#6366f1",color:"white",borderRadius:"50%",width:"16px",height:"16px",fontSize:"9px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>{i+1}</span>
                      <p style={{color:"white",fontSize:"11px",lineHeight:1.6}}>{r}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ):null}

      {/* ログ一覧 */}
      {logs.length>0&&(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"14px 18px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"10px"}}>📋 記録ログ（直近{logs.length}件）</p>
          <div className="space-y-2">
            {logs.map((l:any,i:number)=>(
              <div key={i} style={{background:"#f8f9fc",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"4px"}}>
                  <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                    <span style={{background:"rgba(79,70,229,0.1)",borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:"#4f46e5",fontWeight:600}}>{l.action_type}</span>
                    <span style={{background:`${RESULT_COLORS[l.result]||"#6b7280"}15`,borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:RESULT_COLORS[l.result]||"#6b7280",fontWeight:600}}>{l.result}</span>
                    {l.revisit&&<span style={{background:"rgba(5,150,105,0.1)",borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:"#059669",fontWeight:600}}>再来✓</span>}
                  </div>
                  <p style={{color:"#9ca3af",fontSize:"9px"}}>{(l.recorded_at||"").slice(0,10)}</p>
                </div>
                <p style={{color:"#6b7280",fontSize:"11px",marginBottom:"2px"}}>{l.customer_name} / {l.ai_proposal}</p>
                {l.revenue_change&&<p style={{color:"#059669",fontSize:"10px"}}>売上変化: {l.revenue_change}円</p>}
                {l.notes&&<p style={{color:"#9ca3af",fontSize:"10px"}}>{l.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// EVENT_CATEGORIES: meta.eventCategories を使用すること（業種別定義はINDUSTRY_METAに集約済み）

function EventStreamSection({customer,industry}:{customer:Customer;industry:string}) {
  const meta = INDUSTRY_META[industry]||INDUSTRY_META["nightlife"];
  const [events, setEvents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [filterCat, setFilterCat] = React.useState("ALL");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    event_category: Object.keys(meta.eventCategories)[0]||"LINE",
    event_type: Object.values(meta.eventCategories)[0]?.types[0]||"",
    event_value: "",
    cast_name: "",
    metadata: "",
  });

  React.useEffect(()=>{ loadEvents(); },[]);

  async function loadEvents() {
    setLoading(true);
    try {
      const url = customer.id
        ? `${API_BASE}/api/diagnosis/crm_event_list?customer_id=${customer.id}&limit=100`
        : `${API_BASE}/api/diagnosis/crm_event_list?limit=100`;
      const res = await fetch(url, {headers:authHeaders()});
      if(res.ok){const d=await res.json();setEvents(d.events||[]);}
    } catch{}finally{setLoading(false);}
  }

  async function saveEvent() {
    setSaving(true);setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_event`,{
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({
          customer_id: customer.id||"",
          customer_name: customer.name||"",
          ...form,
        }),
      });
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"保存失敗");}
      await loadEvents();
      setShowForm(false);
      const _firstCat=Object.keys(meta.eventCategories)[0]||"LINE";
      setForm({event_category:_firstCat,event_type:meta.eventCategories[_firstCat]?.types[0]||"",event_value:"",cast_name:"",metadata:""});
    } catch(e:any){setError(e.message);}finally{setSaving(false);}
  }

  async function deleteEvent(id:string) {
    try {
      await fetch(`${API_BASE}/api/diagnosis/crm_event/${id}`,{method:"DELETE",headers:authHeaders()});
      setEvents(prev=>prev.filter(e=>e.id!==id));
    } catch{}
  }

  const filtered = filterCat==="ALL" ? events : events.filter(e=>e.event_category===filterCat);

  const catTypes = meta.eventCategories[form.event_category]?.types || [];

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"4px"}}>EVENT STREAM</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:"white",fontWeight:800,fontSize:"15px",marginBottom:"2px"}}>⚡ イベントストリーム</p>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px"}}>{Object.keys(meta.eventCategories).join("・")}の全行動を時系列記録します</p>
          </div>
          <button onClick={()=>setShowForm(p=>!p)}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"11px",padding:"8px 14px",cursor:"pointer"}}>
            ＋ イベント記録
          </button>
        </div>
        {/* カテゴリ統計 */}
        <div style={{marginTop:"12px",display:"flex",gap:"8px",flexWrap:"wrap" as const}}>
          {Object.entries(meta.eventCategories).map(([cat,cfg])=>{
            const cnt = events.filter(e=>e.event_category===cat).length;
            return(
              <div key={cat} onClick={()=>setFilterCat(filterCat===cat?"ALL":cat)}
                style={{background:"rgba(255,255,255,0.08)",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",border:filterCat===cat?`1px solid ${cfg.color}`:"1px solid transparent"}}>
                <p style={{color:cfg.color,fontWeight:700,fontSize:"14px"}}>{cnt}</p>
                <p style={{color:"rgba(255,255,255,0.5)",fontSize:"9px"}}>{cfg.icon} {cat}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error&&<p style={{color:"#dc2626",fontSize:"12px",padding:"8px 12px",background:"rgba(220,38,38,0.08)",borderRadius:"8px"}}>⚠️ {error}</p>}

      {/* イベント記録フォーム */}
      {showForm&&(
        <div style={{background:"white",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>⚡ イベントを記録</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>カテゴリ</p>
              <select value={form.event_category} onChange={e=>setForm(p=>({...p,event_category:e.target.value,event_type:meta.eventCategories[e.target.value]?.types[0]||""}))}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                {Object.keys(meta.eventCategories).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>イベント種別</p>
              <select value={form.event_type} onChange={e=>setForm(p=>({...p,event_type:e.target.value}))}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                {catTypes.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>値・内容</p>
              <input value={form.event_value} onChange={e=>setForm(p=>({...p,event_value:e.target.value}))} placeholder="例：既読後3時間で返信"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>{`担当${meta.staffNoun}（任意）`}</p>
              <input value={form.cast_name} onChange={e=>setForm(p=>({...p,cast_name:e.target.value}))} placeholder="〇〇ちゃん"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>メモ・補足</p>
              <input value={form.metadata} onChange={e=>setForm(p=>({...p,metadata:e.target.value}))} placeholder="特記事項があれば入力"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={saveEvent} disabled={saving}
              style={{flex:1,padding:"10px",borderRadius:"10px",background:saving?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:"pointer"}}>
              {saving?"記録中...":"⚡ 記録する"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{padding:"10px 16px",borderRadius:"10px",background:"rgba(0,0,0,0.05)",border:"none",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>キャンセル</button>
          </div>
        </div>
      )}

      {/* フィルタバー */}
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap" as const}}>
        <button onClick={()=>setFilterCat("ALL")} style={{padding:"5px 12px",borderRadius:"20px",border:"none",background:filterCat==="ALL"?"#4f46e5":"rgba(0,0,0,0.05)",color:filterCat==="ALL"?"white":"#6b7280",fontSize:"11px",fontWeight:filterCat==="ALL"?700:400,cursor:"pointer"}}>全て({events.length})</button>
        {Object.entries(meta.eventCategories).map(([cat,cfg])=>{
          const cnt=events.filter(e=>e.event_category===cat).length;
          return(
            <button key={cat} onClick={()=>setFilterCat(filterCat===cat?"ALL":cat)}
              style={{padding:"5px 12px",borderRadius:"20px",border:"none",background:filterCat===cat?cfg.color:"rgba(0,0,0,0.05)",color:filterCat===cat?"white":"#6b7280",fontSize:"11px",fontWeight:filterCat===cat?700:400,cursor:"pointer"}}>
              {cfg.icon}{cat}({cnt})
            </button>
          );
        })}
      </div>

      {/* イベントタイムライン */}
      {loading?(
        <p style={{color:"#9ca3af",textAlign:"center" as const,padding:"16px",fontSize:"12px"}}>読み込み中...</p>
      ):filtered.length===0?(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"32px",textAlign:"center" as const}}>
          <p style={{fontSize:"28px",marginBottom:"8px"}}>⚡</p>
          <p style={{color:"#9ca3af",fontSize:"12px"}}>イベントがありません。「＋ イベント記録」から記録してください。</p>
        </div>
      ):(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"16px 20px"}}>
          <div style={{position:"relative" as const}}>
            {/* タイムライン縦線 */}
            <div style={{position:"absolute" as const,left:"15px",top:"8px",bottom:"8px",width:"2px",background:"rgba(0,0,0,0.06)",borderRadius:"1px"}}/>
            <div className="space-y-3">
              {filtered.map((ev:any,i:number)=>{
                const cfg = meta.eventCategories[ev.event_category];
                const color = cfg?.color||"#6b7280";
                const icon = cfg?.icon||"•";
                return(
                  <div key={ev.id||i} style={{display:"flex",gap:"12px",alignItems:"flex-start",position:"relative" as const}}>
                    {/* アイコン */}
                    <div style={{width:"30px",height:"30px",borderRadius:"50%",background:"white",border:`2px solid ${color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"12px",zIndex:1}}>
                      <span>{icon}</span>
                    </div>
                    {/* コンテンツ */}
                    <div style={{flex:1,background:"#f8f9fc",borderRadius:"10px",padding:"8px 12px",border:"1px solid rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"3px"}}>
                        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                          <span style={{background:`${color}15`,borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color,fontWeight:700}}>{ev.event_category}</span>
                          <span style={{color:"#111827",fontSize:"11px",fontWeight:600}}>{ev.event_type}</span>
                        </div>
                        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                          <p style={{color:"#9ca3af",fontSize:"9px"}}>{(ev.timestamp||"").slice(0,16).replace("T"," ")}</p>
                          <button onClick={()=>deleteEvent(ev.id)} style={{color:"#dc2626",background:"none",border:"none",fontSize:"10px",cursor:"pointer",padding:"0 2px"}}>✕</button>
                        </div>
                      </div>
                      {ev.customer_name&&<p style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>👤 {ev.customer_name}</p>}
                      {ev.event_value&&<p style={{color:"#374151",fontSize:"11px",marginBottom:"2px"}}>{ev.event_value}</p>}
                      {ev.cast_name&&<p style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>💃 {ev.cast_name}</p>}
                      {ev.metadata&&<p style={{color:"#9ca3af",fontSize:"10px"}}>{ev.metadata}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// RAG_TYPES: meta.ragTypes を使用すること（業種別定義はINDUSTRY_METAに集約済み）

function MultiRagSection({industry}:{industry:string}) {
  const meta = INDUSTRY_META[industry]||INDUSTRY_META["nightlife"];
  const [chunks, setChunks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [filterType, setFilterType] = React.useState("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    rag_type: "service_rag",
    title: "",
    content: "",
    tags: "",
  });

  React.useEffect(()=>{loadChunks();},[]);

  async function loadChunks() {
    setLoading(true);
    try {
      const url = filterType==="ALL"
        ? `${API_BASE}/api/diagnosis/crm_rag_list`
        : `${API_BASE}/api/diagnosis/crm_rag_list?rag_type=${filterType}`;
      const res = await fetch(url,{headers:authHeaders()});
      if(res.ok){const d=await res.json();setChunks(d.chunks||[]);}
    } catch{}finally{setLoading(false);}
  }

  React.useEffect(()=>{loadChunks();},[filterType]);

  async function saveChunk() {
    if(!form.content.trim()){setError("内容は必須です");return;}
    setSaving(true);setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_rag_add`,{
        method:"POST",headers:authHeaders(),body:JSON.stringify(form)
      });
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"保存失敗");}
      await loadChunks();
      setShowForm(false);
      setForm({rag_type:"service_rag",title:"",content:"",tags:""});
    } catch(e:any){setError(e.message);}finally{setSaving(false);}
  }

  async function deleteChunk(id:string) {
    if(!confirm("このナレッジを削除しますか？"))return;
    try {
      await fetch(`${API_BASE}/api/diagnosis/crm_rag/${id}`,{method:"DELETE",headers:authHeaders()});
      setChunks(prev=>prev.filter(c=>c.id!==id));
    } catch{}
  }

  async function searchRag() {
    if(!searchQuery.trim())return;
    setSearching(true);setSearchResults([]);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_rag_search`,{
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({query:searchQuery,top_k:5})
      });
      if(res.ok){const d=await res.json();setSearchResults(d.results||[]);}
    } catch{}finally{setSearching(false);}
  }

  const filtered = filterType==="ALL" ? chunks : chunks.filter(c=>c.rag_type===filterType);

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"4px"}}>MULTI-RAG KNOWLEDGE BASE</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:"white",fontWeight:800,fontSize:"15px",marginBottom:"2px"}}>🧠 マルチRAGナレッジ</p>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px"}}>{meta.ragDesc}</p>
          </div>
          <button onClick={()=>setShowForm(p=>!p)}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"11px",padding:"8px 14px",cursor:"pointer"}}>
            ＋ ナレッジ登録
          </button>
        </div>
        {/* RAGタイプ統計 */}
        <div style={{marginTop:"12px",display:"flex",gap:"8px",flexWrap:"wrap" as const}}>
          {Object.entries(meta.ragTypes).map(([k,v])=>{
            const cnt=chunks.filter(c=>c.rag_type===k).length;
            return(
              <div key={k} onClick={()=>setFilterType(filterType===k?"ALL":k)}
                style={{background:"rgba(255,255,255,0.08)",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",border:filterType===k?`1px solid ${v.color}`:"1px solid transparent"}}>
                <p style={{color:v.color,fontWeight:700,fontSize:"14px"}}>{cnt}</p>
                <p style={{color:"rgba(255,255,255,0.5)",fontSize:"9px"}}>{v.icon} {v.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error&&<p style={{color:"#dc2626",fontSize:"12px",padding:"8px 12px",background:"rgba(220,38,38,0.08)",borderRadius:"8px"}}>⚠️ {error}</p>}

      {/* RAG検索 */}
      <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"14px 18px"}}>
        <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"10px"}}>🔍 ナレッジ検索（ベクトル検索）</p>
        <div style={{display:"flex",gap:"8px"}}>
          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")searchRag();}}
            placeholder="例：承認型顧客への対応方法"
            style={{flex:1,background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827"}} className="focus:outline-none"/>
          <button onClick={searchRag} disabled={searching||!searchQuery.trim()}
            style={{padding:"8px 16px",borderRadius:"8px",background:searching?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"12px",border:"none",cursor:"pointer"}}>
            {searching?"検索中...":"検索"}
          </button>
        </div>
        {searchResults.length>0&&(
          <div style={{marginTop:"12px"}} className="space-y-2">
            {searchResults.map((r:any,i:number)=>{
              const cfg=(meta.ragTypes[r.rag_type as keyof typeof meta.ragTypes]||meta.ragTypes["service_rag"]);
              return(
                <div key={i} style={{background:"#f8f9fc",borderRadius:"10px",padding:"10px 12px",border:`1px solid ${cfg?.color||"#6b7280"}20`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                    <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                      <span style={{background:`${cfg?.color||"#6b7280"}15`,borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:cfg?.color||"#6b7280",fontWeight:700}}>{cfg?.icon} {cfg?.label||r.rag_type}</span>
                      <span style={{color:"#111827",fontSize:"11px",fontWeight:600}}>{r.title}</span>
                    </div>
                    <span style={{color:"#9ca3af",fontSize:"10px"}}>類似度: {Math.round(r.score*100)}%</span>
                  </div>
                  <p style={{color:"#6b7280",fontSize:"11px",lineHeight:1.6}}>{r.content.slice(0,150)}{r.content.length>150?"...":""}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ナレッジ登録フォーム */}
      {showForm&&(
        <div style={{background:"white",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"16px",padding:"16px 20px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5",marginBottom:"12px"}}>🧠 ナレッジを登録</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>RAGタイプ</p>
              <select value={form.rag_type} onChange={e=>setForm(p=>({...p,rag_type:e.target.value}))}
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}}>
                {Object.entries(meta.ragTypes).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"3px"}}>{(meta.ragTypes[form.rag_type as keyof typeof meta.ragTypes] || meta.ragTypes["service_rag"])?.desc}</p>
            </div>
            <div>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>タイトル</p>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="例：承認型顧客への基本対応"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>内容*</p>
              <textarea value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} rows={4}
                placeholder="例：承認型顧客には「さすがですね」「よく気づきますね」など承認ワードを多用する。自分の話を聞いてもらえていると感じさせることが最重要。"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",resize:"vertical" as const,boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>タグ（カンマ区切り）</p>
              <input value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))} placeholder="例：承認型, LINE, 接客"
                style={{width:"100%",background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:"#111827",boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={saveChunk} disabled={saving||!form.content.trim()}
              style={{flex:1,padding:"10px",borderRadius:"10px",background:saving||!form.content.trim()?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:"pointer"}}>
              {saving?"登録中...":"🧠 登録する"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{padding:"10px 16px",borderRadius:"10px",background:"rgba(0,0,0,0.05)",border:"none",color:"#6b7280",fontSize:"13px",cursor:"pointer"}}>キャンセル</button>
          </div>
        </div>
      )}

      {/* フィルタバー */}
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap" as const}}>
        <button onClick={()=>setFilterType("ALL")} style={{padding:"5px 12px",borderRadius:"20px",border:"none",background:filterType==="ALL"?"#4f46e5":"rgba(0,0,0,0.05)",color:filterType==="ALL"?"white":"#6b7280",fontSize:"11px",fontWeight:filterType==="ALL"?700:400,cursor:"pointer"}}>全て({chunks.length})</button>
        {Object.entries(meta.ragTypes).map(([k,v])=>{
          const cnt=chunks.filter(c=>c.rag_type===k).length;
          return(
            <button key={k} onClick={()=>setFilterType(filterType===k?"ALL":k)}
              style={{padding:"5px 12px",borderRadius:"20px",border:"none",background:filterType===k?v.color:"rgba(0,0,0,0.05)",color:filterType===k?"white":"#6b7280",fontSize:"11px",fontWeight:filterType===k?700:400,cursor:"pointer"}}>
              {v.icon}{v.label}({cnt})
            </button>
          );
        })}
      </div>

      {/* ナレッジ一覧 */}
      {loading?(
        <p style={{color:"#9ca3af",textAlign:"center" as const,padding:"16px",fontSize:"12px"}}>読み込み中...</p>
      ):filtered.length===0?(
        <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"32px",textAlign:"center" as const}}>
          <p style={{fontSize:"28px",marginBottom:"8px"}}>🧠</p>
          <p style={{color:"#9ca3af",fontSize:"12px"}}>ナレッジがありません。「＋ ナレッジ登録」から追加してください。</p>
        </div>
      ):(
        <div className="space-y-3">
          {filtered.map((c:any,i:number)=>{
            const cfg=(meta.ragTypes[c.rag_type as keyof typeof meta.ragTypes]||meta.ragTypes["service_rag"]);
            return(
              <div key={c.id||i} style={{background:"white",border:`1px solid ${cfg?.color||"#6b7280"}20`,borderRadius:"14px",padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                  <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                    <span style={{background:`${cfg?.color||"#6b7280"}15`,borderRadius:"6px",padding:"2px 10px",fontSize:"10px",color:cfg?.color||"#6b7280",fontWeight:700}}>{cfg?.icon} {cfg?.label||c.rag_type}</span>
                    <span style={{color:"#111827",fontSize:"12px",fontWeight:700}}>{c.title||"（タイトルなし）"}</span>
                  </div>
                  <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                    <p style={{color:"#9ca3af",fontSize:"9px"}}>{(c.created_at||"").slice(0,10)}</p>
                    <button onClick={()=>deleteChunk(c.id)} style={{color:"#dc2626",background:"none",border:"1px solid rgba(220,38,38,0.3)",borderRadius:"6px",fontSize:"10px",cursor:"pointer",padding:"1px 7px"}}>削除</button>
                  </div>
                </div>
                <p style={{color:"#6b7280",fontSize:"11px",lineHeight:1.7,marginBottom:"6px"}}>{c.content}</p>
                {c.tags&&(
                  <div style={{display:"flex",gap:"4px",flexWrap:"wrap" as const}}>
                    {c.tags.split(",").map((t:string,j:number)=>(
                      <span key={j} style={{background:"rgba(0,0,0,0.04)",borderRadius:"99px",padding:"1px 8px",fontSize:"9px",color:"#9ca3af"}}>{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RealtimeInferenceSection({customer,industry}:{customer:Customer;industry:string}) {
  const meta = INDUSTRY_META[industry]||INDUSTRY_META["nightlife"];
  const [states, setStates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [inferring, setInferring] = React.useState(false);
  const [latestResult, setLatestResult] = React.useState<any>(null);
  const [triggerEvent, setTriggerEvent] = React.useState("");
  const [error, setError] = React.useState("");

  const TRIGGER_PRESETS = INDUSTRY_TRIGGER_PRESETS[industry] || INDUSTRY_TRIGGER_PRESETS["other"];
  const TEMP_COLOR_MAP2: Record<string,string> = {S:"#dc2626",A:"#d97706",B:"#059669",C:"#0891b2",D:"#6b7280"};
  const RISK_COLOR2: Record<string,string> = {"低":"#059669","中":"#d97706","高":"#dc2626"};

  React.useEffect(()=>{if(customer.id)loadStates();},[customer.id]);

  async function loadStates() {
    if(!customer.id)return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_ai_states/${customer.id}`,{headers:authHeaders()});
      if(res.ok){const d=await res.json();setStates(d.states||[]);}
    } catch{}finally{setLoading(false);}
  }

  async function runInference(trigger: string) {
    if(!trigger.trim()){setError("トリガーイベントを入力または選択してください");return;}
    setInferring(true);setError("");setLatestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_realtime_inference`,{
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({
          customer_id: customer.id||"",
          trigger_event: trigger,
          customer: customer,
        }),
      });
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"推論失敗");}
      const d = await res.json();
      setLatestResult(d.result);
      setTriggerEvent("");
      await loadStates();
    } catch(e:any){setError(e.message);}finally{setInferring(false);}
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"4px"}}>REALTIME INFERENCE PIPELINE</p>
        <p style={{color:"white",fontWeight:800,fontSize:"15px",marginBottom:"2px"}}>⚡ リアルタイム推論</p>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",marginBottom:"16px"}}>AI関連イベント発生時に、必要な場合のみAI推論を実行し顧客状態を更新します</p>
        {/* 現在状態表示 */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"14px"}}>
          {[
            ["現在温度",customer.temp,TEMP_COLOR_MAP2[customer.temp]||"#6b7280"],
            ["現在欲求",customer.current_desire,"#8b5cf6"],
            ["離脱危険",customer.churn_risk,RISK_COLOR2[customer.churn_risk]||"#6b7280"],
          ].map(([l,v,c])=>(
            <div key={l as string} style={{background:"rgba(255,255,255,0.08)",borderRadius:"10px",padding:"8px 12px",textAlign:"center" as const}}>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:600,marginBottom:"3px"}}>{l as string}</p>
              <p style={{color:c as string,fontWeight:800,fontSize:"15px"}}>{v as string||"-"}</p>
            </div>
          ))}
        </div>
        {/* トリガー入力 */}
        <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
          <input value={triggerEvent} onChange={e=>setTriggerEvent(e.target.value)}
            placeholder="トリガーイベントを入力（例：LINE返信あり）"
            style={{flex:1,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"8px",padding:"8px 12px",fontSize:"12px",color:"white"}} className="focus:outline-none placeholder-gray-500"/>
          <button onClick={()=>runInference(triggerEvent)} disabled={inferring||!triggerEvent.trim()}
            style={{padding:"8px 16px",borderRadius:"8px",background:inferring||!triggerEvent.trim()?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",fontWeight:700,fontSize:"12px",border:"none",cursor:"pointer",whiteSpace:"nowrap" as const}}>
            {inferring?"推論中...":"⚡ 実行"}
          </button>
        </div>
        {/* プリセット */}
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap" as const}}>
          {TRIGGER_PRESETS.map(t=>(
            <button key={t} onClick={()=>runInference(t)} disabled={inferring}
              style={{padding:"4px 10px",borderRadius:"99px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.7)",fontSize:"10px",cursor:"pointer",fontWeight:400}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {error&&<p style={{color:"#dc2626",fontSize:"12px",padding:"8px 12px",background:"rgba(220,38,38,0.08)",borderRadius:"8px"}}>⚠️ {error}</p>}

      {/* 最新推論結果 */}
      {latestResult&&(
        <div style={{background:"white",borderRadius:"16px",padding:"16px 20px",border:"2px solid #059669",boxShadow:"0 4px 16px rgba(5,150,105,0.15)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
            <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#059669"}}/>
            <p style={{color:"#059669",fontSize:"11px",fontWeight:700,letterSpacing:"0.05em"}}>✅ 推論更新完了</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"12px"}}>
            {[
              ["更新後温度",latestResult.updated_temp,TEMP_COLOR_MAP2[latestResult.updated_temp]||"#6b7280"],
              ["更新後欲求",latestResult.updated_desire,"#7c3aed"],
              ["更新後離脱リスク",latestResult.updated_churn_risk,RISK_COLOR2[latestResult.updated_churn_risk]||"#6b7280"],
            ].map(([l,v,c])=>(
              <div key={l as string} style={{background:`${c as string}10`,border:`2px solid ${c as string}40`,borderRadius:"12px",padding:"10px 12px",textAlign:"center" as const}}>
                <p style={{color:"#6b7280",fontSize:"9px",fontWeight:600,marginBottom:"4px"}}>{l as string}</p>
                <p style={{color:c as string,fontWeight:900,fontSize:"18px"}}>{v as string||"-"}</p>
              </div>
            ))}
          </div>
          <div style={{background:"#f8f9fc",borderRadius:"10px",padding:"10px 14px",marginBottom:"8px",border:"1px solid rgba(0,0,0,0.06)"}}>
            <p style={{color:"#6b7280",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>🔍 推論理由</p>
            <p style={{color:"#111827",fontSize:"12px",lineHeight:1.6}}>{latestResult.inference_reason}</p>
          </div>
          {latestResult.immediate_action&&(
            <div style={{background:"rgba(79,70,229,0.08)",borderRadius:"10px",padding:"10px 14px",border:"1px solid rgba(79,70,229,0.2)"}}>
              <p style={{color:"#4f46e5",fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>⚡ 今すぐすべきこと</p>
              <p style={{color:"#111827",fontSize:"13px",fontWeight:700}}>{latestResult.immediate_action}</p>
            </div>
          )}
          <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"8px",textAlign:"right" as const}}>信頼度: {Math.round((latestResult.confidence||0)*100)}%</p>
        </div>
      )}

      {/* 推論履歴 */}
      <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#4f46e5"}}>📋 推論履歴</p>
          <button onClick={loadStates} style={{fontSize:"11px",color:"#6b7280",background:"none",border:"none",cursor:"pointer"}}>更新</button>
        </div>
        {loading?(
          <p style={{color:"#9ca3af",textAlign:"center" as const,fontSize:"12px",padding:"12px"}}>読み込み中...</p>
        ):states.length===0?(
          <p style={{color:"#9ca3af",textAlign:"center" as const,fontSize:"12px",padding:"12px"}}>推論履歴がありません。上のボタンから実行してください。</p>
        ):(
          <div className="space-y-2">
            {states.map((s:any,i:number)=>(
              <div key={s.id||i} style={{background:"#f8f9fc",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"4px"}}>
                  <p style={{color:"#111827",fontSize:"11px",fontWeight:600}}>{s.trigger_event}</p>
                  <p style={{color:"#9ca3af",fontSize:"9px"}}>{(s.inferred_at||"").slice(0,16).replace("T"," ")}</p>
                </div>
                <div style={{display:"flex",gap:"6px",marginBottom:"4px"}}>
                  <span style={{background:`${TEMP_COLOR_MAP2[s.updated_temp]||"#6b7280"}15`,borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:TEMP_COLOR_MAP2[s.updated_temp]||"#6b7280",fontWeight:700}}>温度:{s.updated_temp}</span>
                  <span style={{background:`${RISK_COLOR2[s.updated_churn_risk]||"#6b7280"}15`,borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:RISK_COLOR2[s.updated_churn_risk]||"#6b7280",fontWeight:600}}>離脱:{s.updated_churn_risk}</span>
                  <span style={{background:"rgba(139,92,246,0.1)",borderRadius:"6px",padding:"1px 8px",fontSize:"10px",color:"#7c3aed"}}>{s.updated_desire}</span>
                </div>
                {s.inference_reason&&<p style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>{s.inference_reason}</p>}
                {s.immediate_action&&<p style={{color:"#4f46e5",fontSize:"10px",fontWeight:600}}>→ {s.immediate_action}</p>}
                <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"2px"}}>信頼度: {Math.round((s.confidence||0)*100)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [storeAnalyzing, setStoreAnalyzing] = useState(false);
  const [view, setView] = useState<"list"|"detail"|"new"|"store">("list");
  const [newIndustry, setNewIndustry] = useState<string>("nightlife");
  const [selected, setSelected] = useState<Customer|null>(null);
  const [form, setForm] = useState<Customer>(EMPTY_CUSTOMER);
  const [aiResult, setAiResult] = useState<Record<string,any>|null>(null);
  const [storeIntel, setStoreIntel] = useState<StoreIntelligence|null>(null);
  const [transitions, setTransitions] = useState<any[]>([]);
  const [priority, setPriority] = useState<any>(null);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("ALL");
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<"basic"|"visit"|"talk"|"action"|"danger"|"ai"|"graph"|"cast"|"feedback"|"event"|"rag"|"realtime">("basic");

  useEffect(()=>{
    setMounted(true);
    loadCustomers();
    loadPriority();
    // 7日接触なし自動推論チェック
    fetch(`${API_BASE}/api/diagnosis/crm_auto_inference_check`,{method:"POST",headers:authHeaders()})
      .then(r=>r.json())
      .then(d=>{
        if(d.triggered&&d.triggered.length>0){
          loadCustomers();
          loadPriority();
        }
      }).catch(()=>{});
  },[]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_list`,{headers:authHeaders()});
      if(res.ok){const d=await res.json();setCustomers(d.customers||[]);}
    } catch{}finally{setLoading(false);}
  }
  async function loadPriority() {
    setPriorityLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_priority`,{headers:authHeaders()});
      if(res.ok){
        const d=await res.json();setPriority(d.priority);
        window.dispatchEvent(new CustomEvent("ascend_notif_refresh"));
      } else {
        const e2=await res.json().catch(()=>({}));
        setError(`優先アクション取得失敗: ${e2.detail||res.status}`);
      }
    } catch(e:any){setError(`優先アクション取得エラー: ${e.message||"不明"}`);}
    finally{setPriorityLoading(false);}
  }
  async function saveCustomer() {
    setSaving(true);setError("");
    try {
      const method = form.id?"PUT":"POST";
      const url = form.id?`${API_BASE}/api/diagnosis/crm_customer/${form.id}`:`${API_BASE}/api/diagnosis/crm_customer`;
      const res = await fetch(url,{method,headers:authHeaders(),body:JSON.stringify(form)});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"保存失敗");}
      await loadCustomers();setView("list");
    } catch(e:any){setError(e.message||"エラー");}finally{setSaving(false);}
  }
  async function deleteCustomer(id:string) {
    if(!confirm("この顧客を削除しますか？"))return;
    try {
      await fetch(`${API_BASE}/api/diagnosis/crm_customer/${id}`,{method:"DELETE",headers:authHeaders()});
      await loadCustomers();setView("list");
    } catch{}
  }
  async function analyzeCustomer(customer:Customer) {
    setAnalyzing(true);setAiResult(null);setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_analyze`,{method:"POST",headers:authHeaders(),body:JSON.stringify({customer})});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||"分析失敗");}
      const d = await res.json();
      setAiResult(d.result);
      if(customer.id){
        const t = await fetch(`${API_BASE}/api/diagnosis/crm_transitions/${customer.id}`,{headers:authHeaders()});
        if(t.ok){const td=await t.json();setTransitions(td.transitions||[]);}
      }
      // AI分析後に温度・欲求を更新
      if(d.result?.new_temp) setForm(p=>({...p,temp:d.result.new_temp}));
      if(d.result?.new_desire) setForm(p=>({...p,current_desire:d.result.new_desire}));
    } catch(e:any){setError(e.message||"分析エラー");}finally{setAnalyzing(false);}
  }
  async function analyzeStore() {
    setStoreAnalyzing(true);setStoreIntel(null);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/crm_store_intelligence`,{method:"POST",headers:authHeaders(),body:JSON.stringify({customers})});
      if(res.ok){const d=await res.json();setStoreIntel(d.result);}
    } catch{}finally{setStoreAnalyzing(false);}
  }

  const filtered = customers.filter(c=>{
    const ms=!search||c.name.includes(search);
    const mt=filterTemp==="ALL"||c.temp===filterTemp;
    return ms&&mt;
  });

  if(!mounted)return null;

  // ===== STORE INTELLIGENCE VIEW =====
  if(view==="store") return (
    <div className="space-y-4">
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <button onClick={()=>setView("list")} style={{background:"rgba(0,0,0,0.05)",border:"none",borderRadius:"8px",padding:"6px 12px",fontSize:"12px",cursor:"pointer",color:C.textSub}}>← 戻る</button>
        <h3 style={{fontWeight:800,fontSize:"15px",color:C.textMain}}>🏪 店舗全体知能</h3>
      </div>
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"20px",padding:"20px 24px"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"6px"}}>STORE INTELLIGENCE ENGINE</p>
        <p style={{color:"white",fontWeight:900,fontSize:"16px",marginBottom:"4px"}}>🏪 店舗AI経営分析</p>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",marginBottom:"16px"}}>あなたが登録した顧客データを統合解析し、店舗運営の課題と改善提案を生成します</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"16px"}}>
          {[["総顧客数",String(customers.length)+"名"],["S/A温度",String(customers.filter(c=>["S","A"].includes(c.temp)).length)+"名"],["離脱危険",String(customers.filter(c=>c.churn_risk==="高").length)+"名"]].map(([l,v])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:"10px",padding:"10px 14px"}}>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700}}>{l}</p>
              <p style={{color:"white",fontWeight:900,fontSize:"18px"}}>{v}</p>
            </div>
          ))}
        </div>
        <button onClick={analyzeStore} disabled={storeAnalyzing||customers.length===0}
          style={{width:"100%",padding:"12px",borderRadius:"12px",background:storeAnalyzing?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",fontWeight:700,fontSize:"14px",border:"none",cursor:storeAnalyzing||customers.length===0?"not-allowed":"pointer"}}>
          {storeAnalyzing?"🤖 解析中...":"🤖 店舗AI経営分析を実行"}
        </button>
      </div>
      {/* 心理タイプ分布 */}
      <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>📊 心理タイプ分布</p>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:"8px"}}>
          {PSYCH_TYPES.map(t=>{
            const cnt=customers.filter(c=>c.psych_type===t).length;
            const pct=customers.length?Math.round(cnt/customers.length*100):0;
            return(
              <div key={t} style={{background:"rgba(79,70,229,0.06)",borderRadius:"10px",padding:"8px 12px",minWidth:"80px"}}>
                <p style={{color:C.primary,fontWeight:800,fontSize:"16px"}}>{cnt}</p>
                <p style={{color:C.textMuted,fontSize:"9px"}}>{t}</p>
                <div style={{width:"100%",height:"3px",background:"rgba(0,0,0,0.06)",borderRadius:"99px",marginTop:"4px"}}>
                  <div style={{width:`${pct}%`,height:"3px",background:C.primary,borderRadius:"99px"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 温度分布グラフ */}
      <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
        <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>🌡️ 温度分布</p>
        <div style={{display:"flex",gap:"8px",alignItems:"flex-end",height:"80px"}}>
          {Object.entries(TEMP_LABELS).map(([k,v])=>{
            const cnt=customers.filter(c=>c.temp===k).length;
            const max=Math.max(...Object.keys(TEMP_LABELS).map(kk=>customers.filter(c=>c.temp===kk).length),1);
            const h=Math.round(cnt/max*70);
            return(
              <div key={k} style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:"4px"}}>
                <p style={{color:TEMP_COLORS[k],fontWeight:700,fontSize:"12px"}}>{cnt}</p>
                <div style={{width:"100%",height:`${h}px`,background:TEMP_COLORS[k],borderRadius:"4px 4px 0 0",minHeight:"4px"}}/>
                <p style={{color:TEMP_COLORS[k],fontSize:"9px",fontWeight:700}}>{k}</p>
                <p style={{color:C.textMuted,fontSize:"8px"}}>{v}</p>
              </div>
            );
          })}
        </div>
      </div>
      {/* AI経営提案 */}
      {storeIntel && (
        <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"20px",padding:"20px 24px"}}>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"14px"}}>🤖 AI経営提案</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
            {[
              ["離脱トレンド",storeIntel.churn_trend,"#dc2626"],
              ["スタッフ疲弊",storeIntel.cast_fatigue,"#d97706"],
              ["クレーム連鎖",storeIntel.claim_chain,"#dc2626"],
              ["指名偏り",storeIntel.nomination_bias,"#d97706"],
              ["売上停滞",storeIntel.revenue_stagnation,"#0891b2"],
              ["LINE疲労",storeIntel.line_fatigue,"#8b5cf6"],
            ].map(([l,v,col])=>(
              <div key={l as string} style={{background:"rgba(255,255,255,0.06)",borderRadius:"10px",padding:"10px 12px",border:`1px solid ${col}30`}}>
                <p style={{color:col as string,fontSize:"9px",fontWeight:700,marginBottom:"4px"}}>{l as string}</p>
                <p style={{color:"rgba(255,255,255,0.85)",fontSize:"11px",lineHeight:1.5}}>{v as string}</p>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(99,102,241,0.2)",borderRadius:"12px",padding:"14px 16px",border:"1px solid rgba(99,102,241,0.4)"}}>
            <p style={{color:"#a5b4fc",fontSize:"10px",fontWeight:700,marginBottom:"10px"}}>💡 AI改善提案</p>
            {(storeIntel.proposals||[]).map((p:string,i:number)=>(
              <div key={i} style={{display:"flex",gap:"8px",alignItems:"flex-start",marginBottom:"6px"}}>
                <span style={{background:"#6366f1",color:"white",borderRadius:"50%",width:"16px",height:"16px",fontSize:"9px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>{i+1}</span>
                <p style={{color:"white",fontSize:"12px",lineHeight:1.6}}>{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ===== LIST VIEW =====
  if(view==="list") return (
    <div className="space-y-4">
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"20px",padding:"20px 24px",boxShadow:"0 8px 32px rgba(99,102,241,0.25)"}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"6px"}}>CUSTOMER AI MANAGEMENT</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{color:"white",fontWeight:900,fontSize:"17px",marginBottom:"3px"}}>👥 顧客AIマネジメント</h2>
            <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px"}}>顧客の心理状態を時系列推論し、最適対応を提案します</p>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setView("store")} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"12px",color:"white",fontWeight:700,fontSize:"11px",padding:"8px 14px",cursor:"pointer"}}>🏪 店舗知能</button>
            <button onClick={()=>{setForm({...EMPTY_CUSTOMER,industry:newIndustry});setView("new");}} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:"12px",color:"white",fontWeight:700,fontSize:"12px",padding:"10px 20px",cursor:"pointer"}}>＋ 顧客登録</button>
          </div>
        </div>
        {/* 業種選択 */}
        <div style={{marginTop:"14px",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>登録する顧客の業種を選択</p>
          <div style={{display:"flex",flexWrap:"wrap" as const,gap:"6px"}}>
            {INDUSTRY_LIST.map(ind=>(
              <button key={ind.id} onClick={()=>setNewIndustry(ind.id)}
                style={{padding:"5px 12px",borderRadius:"20px",border:`1px solid ${newIndustry===ind.id?"rgba(99,102,241,0.8)":"rgba(255,255,255,0.15)"}`,background:newIndustry===ind.id?"rgba(99,102,241,0.35)":"rgba(255,255,255,0.06)",color:newIndustry===ind.id?"white":"rgba(255,255,255,0.55)",fontSize:"11px",fontWeight:newIndustry===ind.id?700:400,cursor:"pointer",whiteSpace:"nowrap" as const}}>
                {ind.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginTop:"16px",display:"flex",gap:"12px",flexWrap:"wrap" as const}}>
          {Object.entries(TEMP_LABELS).map(([k,v])=>{
            const count=customers.filter(c=>c.temp===k).length;
            return(
              <div key={k} style={{background:"rgba(255,255,255,0.08)",borderRadius:"10px",padding:"8px 14px",cursor:"pointer",border:filterTemp===k?`1px solid ${TEMP_COLORS[k]}`:"1px solid transparent"}}
                onClick={()=>setFilterTemp(filterTemp===k?"ALL":k)}>
                <p style={{color:TEMP_COLORS[k],fontWeight:800,fontSize:"16px"}}>{count}</p>
                <p style={{color:"rgba(255,255,255,0.5)",fontSize:"9px"}}>{k}: {v}</p>
              </div>
            );
          })}
        </div>
      </div>
      {/* 優先順位エンジン */}
      {priorityLoading && (
        <div style={{background:"white",border:"1px solid rgba(220,38,38,0.2)",borderRadius:"16px",padding:"16px 20px",textAlign:"center"}}>
          <p style={{color:"#dc2626",fontSize:"12px",fontWeight:700}}>⏳ 優先アクション計算中...</p>
        </div>
      )}
      {!priorityLoading && priority && !(priority.contact_now?.filter((x:any)=>x.line_direction||x.line_timing).length||priority.churn_danger?.filter((x:any)=>x.line_direction||x.line_timing).length||priority.revenue_expect?.filter((x:any)=>x.line_direction||x.line_timing).length||priority.leave_alone?.length||priority.mental_danger?.filter((x:any)=>x.line_forbidden&&x.line_forbidden!=="なし").length) && (
        <div style={{background:"white",border:"1px solid rgba(220,38,38,0.2)",borderRadius:"16px",padding:"16px 20px",textAlign:"center"}}>
          <p style={{color:"#6b7280",fontSize:"12px"}}>現在、優先アクションはありません</p>
        </div>
      )}
      {priority && (priority.contact_now?.filter((x:any)=>x.line_direction||x.line_timing).length||priority.churn_danger?.filter((x:any)=>x.line_direction||x.line_timing).length||priority.revenue_expect?.filter((x:any)=>x.line_direction||x.line_timing).length||priority.leave_alone?.length||priority.mental_danger?.filter((x:any)=>x.line_forbidden&&x.line_forbidden!=="なし").length) && (
        <div style={{background:"white",border:"1px solid rgba(220,38,38,0.2)",borderRadius:"16px",padding:"16px 20px",boxShadow:"0 2px 8px rgba(220,38,38,0.08)"}}>
          <p style={{fontWeight:700,fontSize:"12px",color:"#dc2626",marginBottom:"12px"}}>🚨 今日の優先アクション</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
            {priority.contact_now?.filter((x:any)=>x.line_direction||x.line_timing).length>0&&(
              <div style={{background:"rgba(220,38,38,0.06)",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(220,38,38,0.15)"}}>
                <p style={{color:"#dc2626",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>📲 今日連絡すべき顧客</p>
                {priority.contact_now.filter((x:any)=>x.line_direction||x.line_timing).map((n:any,i:number)=>(
                  <div key={i} style={{marginBottom:"10px",paddingBottom:"10px",borderBottom:"1px solid rgba(220,38,38,0.1)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <p style={{color:C.textMain,fontSize:"12px",fontWeight:700}}>• {typeof n==="string"?n:n.name}</p>
                      {n.revisit_probability&&<span style={{color:"#dc2626",fontSize:"9px",fontWeight:700}}>再来{n.revisit_probability}%</span>}
                    </div>
                    {n.line_direction&&<p style={{color:"#dc2626",fontSize:"10px",marginBottom:"2px"}}>💬 {n.line_direction}</p>}
                    {n.line_timing&&<p style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>⏰ {n.line_timing}</p>}
                    {n.line_forbidden&&n.line_forbidden!=="なし"&&<p style={{color:"#9ca3af",fontSize:"9px"}}>🚫 {n.line_forbidden}</p>}
                  </div>
                ))}
              </div>
            )}
            {priority.churn_danger?.filter((x:any)=>x.line_direction||x.line_timing).length>0&&(
              <div style={{background:"rgba(217,119,6,0.06)",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(217,119,6,0.15)"}}>
                <p style={{color:"#d97706",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>⚠️ 離脱危険顧客</p>
                {priority.churn_danger.filter((x:any)=>x.line_direction||x.line_timing).map((n:any,i:number)=>(
                  <div key={i} style={{marginBottom:"10px",paddingBottom:"10px",borderBottom:"1px solid rgba(217,119,6,0.1)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <p style={{color:C.textMain,fontSize:"12px",fontWeight:700}}>• {typeof n==="string"?n:n.name}</p>
                      {n.churn_risk_score&&<span style={{color:"#d97706",fontSize:"9px",fontWeight:700}}>危険{n.churn_risk_score}%</span>}
                    </div>
                    {n.line_direction&&<p style={{color:"#d97706",fontSize:"10px",marginBottom:"2px"}}>💬 {n.line_direction}</p>}
                    {n.line_timing&&<p style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>⏰ {n.line_timing}</p>}
                    {n.line_forbidden&&n.line_forbidden!=="なし"&&<p style={{color:"#9ca3af",fontSize:"9px"}}>🚫 {n.line_forbidden}</p>}
                  </div>
                ))}
              </div>
            )}
            {priority.revenue_expect?.filter((x:any)=>x.line_direction||x.line_timing).length>0&&(
              <div style={{background:"rgba(5,150,105,0.06)",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(5,150,105,0.15)"}}>
                <p style={{color:"#059669",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>💰 売上期待顧客</p>
                {priority.revenue_expect.filter((x:any)=>x.line_direction||x.line_timing).map((n:any,i:number)=>(
                  <div key={i} style={{marginBottom:"10px",paddingBottom:"10px",borderBottom:"1px solid rgba(5,150,105,0.1)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <p style={{color:C.textMain,fontSize:"12px",fontWeight:700}}>• {typeof n==="string"?n:n.name}</p>
                      {n.vip_probability&&<span style={{color:"#059669",fontSize:"9px",fontWeight:700}}>VIP{n.vip_probability}%</span>}
                    </div>
                    {n.line_direction&&<p style={{color:"#059669",fontSize:"10px",marginBottom:"2px"}}>💬 {n.line_direction}</p>}
                    {n.line_timing&&<p style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>⏰ {n.line_timing}</p>}
                    {n.line_forbidden&&n.line_forbidden!=="なし"&&<p style={{color:"#9ca3af",fontSize:"9px"}}>🚫 {n.line_forbidden}</p>}
                  </div>
                ))}
              </div>
            )}
            {priority.leave_alone?.length>0&&(
              <div style={{background:"rgba(107,114,128,0.06)",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(107,114,128,0.15)"}}>
                <p style={{color:C.textSub,fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>🔇 放置推奨顧客</p>
                {priority.leave_alone.map((n:any,i:number)=>(
                  <p key={i} style={{color:C.textMain,fontSize:"11px",marginBottom:"2px"}}>• {typeof n==="string"?n:n.name}</p>
                ))}
              </div>
            )}
            {priority.mental_danger?.filter((x:any)=>x.line_forbidden&&x.line_forbidden!=="なし").length>0&&(
              <div style={{background:"rgba(124,58,237,0.06)",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(124,58,237,0.15)",gridColumn:"1/-1"}}>
                <p style={{color:"#7c3aed",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>🧠 メンタル危険顧客（依存・執着リスク高）</p>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap" as const}}>
                  {priority.mental_danger.filter((x:any)=>x.line_forbidden&&x.line_forbidden!=="なし").map((n:any,i:number)=>(
                    <div key={i} style={{background:"rgba(124,58,237,0.08)",borderRadius:"8px",padding:"4px 10px",display:"flex",gap:"6px",alignItems:"center"}}>
                      <span style={{color:"#7c3aed",fontSize:"11px",fontWeight:600}}>{typeof n==="string"?n:n.name}</span>
                      {n.mental_danger_score&&<span style={{color:"#7c3aed",fontSize:"9px"}}>危険度{n.mental_danger_score}%</span>}
                      {n.dependency_risk_score&&<span style={{color:"#dc2626",fontSize:"9px"}}>依存{n.dependency_risk_score}%</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:"8px"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="顧客名で検索..."
          style={{flex:1,background:"white",border:`1px solid ${C.border}`,borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:C.textMain}} className="focus:outline-none"/>
        <button onClick={()=>setFilterTemp("ALL")} style={{background:"rgba(79,70,229,0.1)",border:`1px solid ${C.borderPrimary}`,borderRadius:"10px",color:C.primary,padding:"9px 14px",fontSize:"12px",fontWeight:600,cursor:"pointer"}}>全表示</button>
      </div>
      {loading?(
        <p style={{color:C.textMuted,textAlign:"center" as const,padding:"24px"}}>読み込み中...</p>
      ):filtered.length===0?(
        <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"32px",textAlign:"center" as const}}>
          <p style={{fontSize:"32px",marginBottom:"8px"}}>👥</p>
          <p style={{color:C.textMuted,fontSize:"13px"}}>顧客が登録されていません</p>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
          {filtered.map((c,i)=>(
            <div key={c.id||i} onClick={()=>{setSelected(c);setForm(c);setAiResult(null);setTransitions([]);setView("detail");}}
              style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px",cursor:"pointer",boxShadow:C.shadow}}
              onMouseEnter={e=>(e.currentTarget.style.boxShadow=C.shadowMd)}
              onMouseLeave={e=>(e.currentTarget.style.boxShadow=C.shadow)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                <div>
                  <p style={{fontWeight:800,fontSize:"15px",color:C.textMain}}>{c.name}</p>
                  <p style={{color:C.textMuted,fontSize:"11px"}}>{c.occupation} / {c.area}</p>
                </div>
                <div style={{background:TEMP_COLORS[c.temp]+"18",border:`1px solid ${TEMP_COLORS[c.temp]}40`,borderRadius:"8px",padding:"4px 10px",textAlign:"center" as const}}>
                  <p style={{color:TEMP_COLORS[c.temp],fontWeight:800,fontSize:"16px",lineHeight:1}}>{c.temp}</p>
                  <p style={{color:TEMP_COLORS[c.temp],fontSize:"8px",fontWeight:600}}>{TEMP_LABELS[c.temp]}</p>
                </div>
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap" as const,marginBottom:"8px"}}>
                <span style={{background:"rgba(79,70,229,0.08)",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:C.primary,fontWeight:600}}>{c.psych_type}</span>
                <span style={{background:"rgba(0,0,0,0.04)",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:C.textSub}}>{c.current_desire}</span>
                <span style={{background:c.churn_risk==="高"?"rgba(220,38,38,0.1)":c.churn_risk==="中"?"rgba(217,119,6,0.1)":"rgba(5,150,105,0.1)",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:c.churn_risk==="高"?"#dc2626":c.churn_risk==="中"?"#d97706":"#059669",fontWeight:600}}>離脱:{c.churn_risk}</span>
                {c.claim_history&&<span style={{background:"rgba(220,38,38,0.08)",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:"#dc2626"}}>⚠️ クレーム歴</span>}
                {c.obsession_tendency&&<span style={{background:"rgba(124,58,237,0.08)",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:"#7c3aed"}}>🔒 執着傾向</span>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"10px",color:C.textMuted}}>
                <span>来店{c.visit_count}回</span>
                <span>最終: {c.last_visit||"未記録"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* 使い方ガイド */}
      <GuideSection />
    </div>
  );

  // ===== FORM VIEW =====
  const isNew = view==="new";
  if(view==="new"||(view==="detail"&&selected)){
    const f = form;
    const BASE_TAB_MAP: Record<string,{id:string;label:string}> = {
      basic:    {id:"basic",    label:"基本"},
      visit:    {id:"visit",    label:"来店"},
      talk:     {id:"talk",     label:"会話"},
      action:   {id:"action",   label:"行動"},
      danger:   {id:"danger",   label:"⚠️危険"},
      ai:       {id:"ai",       label:"🤖AI"},
      graph:    {id:"graph",    label:"📊グラフ"},
      cast:     {id:"cast",     label:`${(INDUSTRY_META[form.industry]||INDUSTRY_META["nightlife"]).staffIcon}相性`},
      feedback: {id:"feedback", label:(INDUSTRY_META[form.industry]||INDUSTRY_META["nightlife"]).feedbackLabel||"🔄学習"},
      event:    {id:"event",    label:(INDUSTRY_META[form.industry]||INDUSTRY_META["nightlife"]).eventLabel||"⚡イベント"},
      rag:      {id:"rag",      label:"🧠RAG"},
      realtime: {id:"realtime", label:"⚡推論"},
    };
    const INDUSTRY_TAB_CONFIG: Record<string,string[]> = {
      nightlife:  ["basic","visit","talk","action","danger","ai","graph","cast","feedback","event","rag","realtime"],
      retail:     ["basic","visit","talk","action","danger","ai","graph","feedback","event","rag","realtime"],
      b2b:        ["basic","visit","talk","action","danger","ai","graph","feedback","event","rag","realtime"],
      beauty:     ["basic","visit","talk","action","danger","ai","graph","cast","feedback","event","rag","realtime"],
      fitness:    ["basic","visit","action","danger","ai","graph","cast","feedback","event","rag","realtime"],
      realestate: ["basic","visit","talk","action","danger","ai","graph","feedback","event","rag","realtime"],
      other:      ["basic","visit","talk","action","danger","ai","graph","feedback","event","rag","realtime"],
    };
    const SECTIONS = (INDUSTRY_TAB_CONFIG[form.industry] || INDUSTRY_TAB_CONFIG["nightlife"])
      .map(id => BASE_TAB_MAP[id])
      .filter(Boolean);
    return (
      <div className="space-y-4">
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <button onClick={()=>{setView("list");setAiResult(null);}} style={{background:"rgba(0,0,0,0.05)",border:"none",borderRadius:"8px",padding:"6px 12px",fontSize:"12px",cursor:"pointer",color:C.textSub}}>← 戻る</button>
          <h3 style={{fontWeight:800,fontSize:"15px",color:C.textMain}}>{isNew?"新規顧客登録":f.name+" の編集"}</h3>
          {!isNew&&f.id&&(
            <button onClick={()=>deleteCustomer(f.id!)} style={{marginLeft:"auto",background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:"8px",padding:"6px 12px",fontSize:"12px",cursor:"pointer",color:"#dc2626"}}>削除</button>
          )}
        </div>
        {/* セクションタブ */}
        <div style={{display:"flex",gap:"6px",overflowX:"auto" as const,paddingBottom:"4px"}}>
          {SECTIONS.map(s=>(
            <button key={s.id} onClick={()=>setActiveSection(s.id as any)}
              style={{padding:"6px 14px",borderRadius:"20px",border:"none",background:activeSection===s.id?"linear-gradient(135deg,#4f46e5,#7c3aed)":"rgba(0,0,0,0.05)",color:activeSection===s.id?"white":C.textSub,fontSize:"12px",fontWeight:activeSection===s.id?700:400,cursor:"pointer",whiteSpace:"nowrap" as const}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* 基本情報 */}
        {activeSection==="basic"&&(
          <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>■ 基本情報</p>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              <Field form={form} setForm={setForm} label="顧客名*" k="name" ph="田中さん"/>
              <Field form={form} setForm={setForm} label="年齢" k="age" ph="28"/>
              <Field form={form} setForm={setForm} label="職業" k="occupation" ph="会社員"/>
              <Field form={form} setForm={setForm} label="居住地・エリア" k="area" ph="渋谷"/>
              <Field form={form} setForm={setForm} label="SNS" k="sns" ph="@handle"/>
              <div>
                <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>LINE有無</p>
                <div style={{display:"flex",gap:"8px"}}>
                  {[true,false].map(v=>(
                    <button key={String(v)} onClick={()=>setForm(p=>({...p,line_yn:v}))}
                      style={{flex:1,padding:"8px",borderRadius:"8px",border:`1px solid ${f.line_yn===v?C.primary:C.border}`,background:f.line_yn===v?"rgba(79,70,229,0.1)":"#f8f9fc",color:f.line_yn===v?C.primary:C.textSub,fontSize:"12px",fontWeight:f.line_yn===v?700:400,cursor:"pointer"}}>
                      {v?"あり":"なし"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 来店情報 */}
        {activeSection==="visit"&&(
          <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>■ {(INDUSTRY_META[form.industry]||INDUSTRY_META["nightlife"]).visitLabel}情報</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {(INDUSTRY_FIELDS[form.industry]||INDUSTRY_FIELDS["other"]).visit.map(({label,k,ph,type,textarea})=>(
                textarea
                  ? <TextArea key={k} form={form} setForm={setForm} label={label} k={k} ph={ph}/>
                  : <Field key={k} form={form} setForm={setForm} label={label} k={k} ph={ph} type={type}/>
              ))}
            </div>
          </div>
        )}

        {/* 会話情報 */}
        {activeSection==="talk"&&(
          <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>■ 会話・関係情報</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {(INDUSTRY_FIELDS[form.industry]||INDUSTRY_FIELDS["other"]).talk.map(({label,k,ph})=>(
                <Field key={k} form={form} setForm={setForm} label={label} k={k} ph={ph}/>
              ))}
            </div>
          </div>
        )}

        {/* 行動情報 */}
        {activeSection==="action"&&(
          <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>■ 行動情報</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {(INDUSTRY_FIELDS[form.industry]||INDUSTRY_FIELDS["other"]).action.map(({label,k,ph})=>(
                <Field key={k} form={form} setForm={setForm} label={label} k={k} ph={ph}/>
              ))}
            </div>
          </div>
        )}

        {/* 危険情報 */}
        {activeSection==="danger"&&(
          <div style={{background:"rgba(254,242,242,0.8)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:"#dc2626",marginBottom:"4px"}}>⚠️ 危険情報（要注意・機密）</p>
            <p style={{color:"#9ca3af",fontSize:"10px",marginBottom:"12px"}}>この情報は厳重に管理してください</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {(INDUSTRY_FIELDS[form.industry]||INDUSTRY_FIELDS["other"]).danger.map(({label,k,ph})=>(
                <TextArea key={k} form={form} setForm={setForm} label={label} k={k} ph={ph}/>
              ))}
            </div>
          </div>
        )}

        {/* AI推論設定 */}
        {activeSection==="ai"&&(
          <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"4px"}}>■ AI推論設定</p>
            <p style={{color:C.textMuted,fontSize:"10px",marginBottom:"12px",lineHeight:1.6}}>手動で現在状態を設定するか、「AI分析を実行」で自動更新されます。AI分析の精度を上げるために、他セクションの情報をできるだけ入力してください。</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {(()=>{const _ai=INDUSTRY_AI_SCHEMA[form.industry]||INDUSTRY_AI_SCHEMA["other"];return(<>
              <div>
                <SelectField form={form} setForm={setForm} label={_ai.tempLabel} k="temp" opts={Object.keys(TEMP_LABELS)}/>
                <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"3px"}}>{_ai.tempDesc}</p>
              </div>
              <div>
                <SelectField form={form} setForm={setForm} label={_ai.psychLabel} k="psych_type" opts={PSYCH_TYPES}/>
                <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"3px"}}>{_ai.psychDesc}</p>
              </div>
              <div>
                <SelectField form={form} setForm={setForm} label={_ai.desireLabel} k="current_desire" opts={DESIRE_TYPES}/>
                <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"3px"}}>{_ai.desireDesc}</p>
              </div>
              <div>
                <SelectField form={form} setForm={setForm} label={_ai.churnLabel} k="churn_risk" opts={["低","中","高"]}/>
                <p style={{color:"#9ca3af",fontSize:"9px",marginTop:"3px"}}>{_ai.churnDesc}</p>
              </div>
              </>);})()}
            </div>
            <div style={{marginTop:"8px"}}>
              <p style={{color:"#6b7280",fontSize:"11px",fontWeight:600,marginBottom:"3px"}}>メモ・特記事項</p>
              <textarea value={f.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3}
                style={{width:"100%",background:"#f8f9fc",border:`1px solid ${C.border}`,borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:C.textMain,resize:"vertical" as const,boxSizing:"border-box" as const}} className="focus:outline-none"/>
            </div>
          </div>
        )}

        {error&&<p style={{color:"#dc2626",fontSize:"12px",padding:"8px 12px",background:"rgba(220,38,38,0.08)",borderRadius:"8px"}}>⚠️ {error}</p>}

        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={saveCustomer} disabled={saving||!f.name.trim()}
            style={{flex:1,padding:"12px",borderRadius:"12px",background:saving||!f.name.trim()?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:700,fontSize:"14px",border:"none",cursor:saving||!f.name.trim()?"not-allowed":"pointer"}}>
            {saving?"保存中...":"💾 保存する"}
          </button>
          {!isNew&&selected&&(
            <button onClick={()=>analyzeCustomer(form)} disabled={analyzing}
              style={{flex:1,padding:"12px",borderRadius:"12px",background:analyzing?"rgba(0,0,0,0.1)":"linear-gradient(135deg,#059669,#0891b2)",color:"white",fontWeight:700,fontSize:"14px",border:"none",cursor:analyzing?"not-allowed":"pointer"}}>
              {analyzing?"🤖 分析中...":"🤖 AI分析を実行"}
            </button>
          )}
        </div>

        {/* 状態遷移履歴 */}
        {transitions.length>0&&(
          <div style={{background:"white",border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{fontWeight:700,fontSize:"12px",color:C.primary,marginBottom:"12px"}}>📈 状態遷移履歴</p>
            <div style={{display:"flex",gap:"6px",overflowX:"auto" as const,paddingBottom:"4px"}}>
              {transitions.map((t:any,i:number)=>(
                <div key={i} style={{flexShrink:0,background:"rgba(79,70,229,0.06)",borderRadius:"10px",padding:"8px 12px",minWidth:"120px",border:"1px solid rgba(79,70,229,0.1)"}}>
                  <p style={{color:C.textMuted,fontSize:"9px",marginBottom:"4px"}}>{(t.detected_at||"").slice(0,10)}</p>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",marginBottom:"4px"}}>
                    <span style={{color:TEMP_COLORS[t.previous_temperature]||C.textMuted,fontWeight:700,fontSize:"13px"}}>{t.previous_temperature}</span>
                    <span style={{color:C.textMuted,fontSize:"10px"}}>→</span>
                    <span style={{color:TEMP_COLORS[t.current_temperature]||C.textMuted,fontWeight:700,fontSize:"13px"}}>{t.current_temperature}</span>
                  </div>
                  <p style={{color:C.textSub,fontSize:"9px",lineHeight:1.4}}>{t.trigger_reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 時系列グラフ */}
        {activeSection==="graph"&&(
          <CustomerGraphSection customer={form} transitions={transitions} />
        )}
        {/* キャスト相性 */}
        {activeSection==="cast"&&(
          <CastAffinitySection customer={form} industry={form.industry||"nightlife"} />
        )}
        {/* フィードバック学習 */}
        {activeSection==="feedback"&&(
          <ActionFeedbackSection customer={form} industry={form.industry||"nightlife"} />
        )}
        {/* イベントストリーム */}
        {activeSection==="event"&&(
          <EventStreamSection customer={form} industry={form.industry||"nightlife"} />
        )}
        {/* マルチRAG */}
        {activeSection==="rag"&&(
          <MultiRagSection industry={form.industry||"nightlife"} />
        )}
        {/* リアルタイム推論 */}
        {activeSection==="realtime"&&(
          <RealtimeInferenceSection customer={form} industry={form.industry||"nightlife"} />
        )}
        {/* 使い方ガイド */}
        <GuideSection />

        {/* AI分析結果 */}
        {aiResult&&(
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"20px",padding:"20px 24px"}}>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"12px"}}>🤖 AI推論レポート</p>
            {/* ガードレール注記 */}
            <div style={{background:"rgba(220,38,38,0.1)",borderRadius:"8px",padding:"8px 12px",marginBottom:"12px",border:"1px solid rgba(220,38,38,0.2)"}}>
              <p style={{color:"#fca5a5",fontSize:"9px",lineHeight:1.5}}>⚠️ このレポートは確率・傾向の提示です。断定ではありません。最終判断は必ずスタッフ自身が行ってください。</p>
            </div>
            {aiResult.brief&&(
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"12px",padding:"14px 16px",marginBottom:"12px"}}>
                <p style={{color:"rgba(255,255,255,0.5)",fontSize:"10px",fontWeight:700,marginBottom:"8px"}}>📋 接客前ブリーフ</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {Object.entries(aiResult.brief as Record<string,string>).map(([k,v])=>(
                    <div key={k} style={{background:"rgba(255,255,255,0.04)",borderRadius:"8px",padding:"8px 10px"}}>
                      <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:700,marginBottom:"2px"}}>{k}</p>
                      <p style={{color:"white",fontSize:"11px",lineHeight:1.5}}>{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiResult.style_proposal&&(
              <div style={{background:"rgba(99,102,241,0.15)",borderRadius:"12px",padding:"14px 16px",marginBottom:"12px",border:"1px solid rgba(99,102,241,0.3)"}}>
                <p style={{color:"#a5b4fc",fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>✨ 推奨接客スタイル</p>
                <p style={{color:"white",fontWeight:800,fontSize:"14px",marginBottom:"6px"}}>{aiResult.style_proposal.style}</p>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap" as const}}>
                  {(aiResult.style_proposal.points||[]).map((p:string,i:number)=>(
                    <span key={i} style={{background:"rgba(165,180,252,0.15)",border:"1px solid rgba(165,180,252,0.3)",borderRadius:"99px",padding:"3px 10px",fontSize:"10px",color:"#a5b4fc"}}>{p}</span>
                  ))}
                </div>
              </div>
            )}
            {aiResult.line_strategy&&(
              <div style={{background:"rgba(5,150,105,0.1)",borderRadius:"12px",padding:"14px 16px",marginBottom:"12px",border:"1px solid rgba(5,150,105,0.2)"}}>
                <p style={{color:"#6ee7b7",fontSize:"10px",fontWeight:700,marginBottom:"8px"}}>💬 LINE戦略</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {Object.entries(aiResult.line_strategy as Record<string,string>).map(([k,v])=>(
                    <div key={k} style={{background:"rgba(255,255,255,0.04)",borderRadius:"8px",padding:"8px 10px"}}>
                      <p style={{color:"rgba(110,231,183,0.6)",fontSize:"9px",fontWeight:700,marginBottom:"2px"}}>{k}</p>
                      <p style={{color:"white",fontSize:"11px"}}>{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiResult.upsell&&(
              <div style={{background:"rgba(217,119,6,0.1)",borderRadius:"12px",padding:"14px 16px",marginBottom:"12px",border:"1px solid rgba(217,119,6,0.2)"}}>
                <p style={{color:"#fbbf24",fontSize:"10px",fontWeight:700,marginBottom:"8px"}}>💰 単価UP可能性</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {Object.entries(aiResult.upsell as Record<string,string>).map(([k,v])=>(
                    <div key={k} style={{background:"rgba(255,255,255,0.04)",borderRadius:"8px",padding:"8px 10px"}}>
                      <p style={{color:"rgba(251,191,36,0.6)",fontSize:"9px",fontWeight:700,marginBottom:"2px"}}>{k}</p>
                      <p style={{color:"white",fontSize:"11px"}}>{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiResult.churn_analysis&&(
              <div style={{background:"rgba(220,38,38,0.1)",borderRadius:"12px",padding:"14px 16px",border:"1px solid rgba(220,38,38,0.2)"}}>
                <p style={{color:"#fca5a5",fontSize:"10px",fontWeight:700,marginBottom:"8px"}}>🚨 離脱危険解析</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {Object.entries(aiResult.churn_analysis as Record<string,string>).map(([k,v])=>(
                    <div key={k} style={{background:"rgba(255,255,255,0.04)",borderRadius:"8px",padding:"8px 10px"}}>
                      <p style={{color:"rgba(252,165,165,0.6)",fontSize:"9px",fontWeight:700,marginBottom:"2px"}}>{k}</p>
                      <p style={{color:"white",fontSize:"11px"}}>{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
}
